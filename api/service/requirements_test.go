package service

import (
	"reflect"
	"testing"
	"time"

	"github.com/aidashboard/api/model"
)

func TestDeriveTaskRisks(t *testing.T) {
	now := time.Date(2026, 6, 24, 12, 0, 0, 0, time.UTC)
	overdue := "2026-06-23"
	overdueFromDatabase := "2026-06-23T00:00:00Z"
	dueSoon := "2026-06-26"

	tests := []struct {
		name string
		task model.Task
		want []string
	}{
		{
			name: "blocked and overdue are both derived",
			task: model.Task{
				Status:       "in_progress",
				DueDate:      &overdue,
				Dependencies: []model.TaskDep{{Status: "todo"}},
			},
			want: []string{TaskRiskBlocked, TaskRiskOverdue},
		},
		{
			name: "database date serialization is supported",
			task: model.Task{Status: "todo", DueDate: &overdueFromDatabase},
			want: []string{TaskRiskOverdue},
		},
		{
			name: "due soon is derived within 48 hours",
			task: model.Task{Status: "todo", DueDate: &dueSoon},
			want: []string{TaskRiskDueSoon},
		},
		{
			name: "done task has no risks",
			task: model.Task{
				Status:       "done",
				DueDate:      &overdue,
				Dependencies: []model.TaskDep{{Status: "todo"}},
			},
			want: []string{},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := DeriveTaskRisks(test.task, now); !reflect.DeepEqual(got, test.want) {
				t.Fatalf("DeriveTaskRisks() = %#v, want %#v", got, test.want)
			}
		})
	}
}

func TestAggregateRequirementProgress(t *testing.T) {
	tasks := []model.Task{{Progress: 25}, {Progress: 75}, {Progress: 100}}
	if got, want := AggregateRequirementProgress(tasks), 66; got != want {
		t.Fatalf("AggregateRequirementProgress() = %d, want %d", got, want)
	}
	if got := AggregateRequirementProgress(nil); got != 0 {
		t.Fatalf("AggregateRequirementProgress(nil) = %d, want 0", got)
	}
}
