package service

import (
	"time"

	"github.com/aidashboard/api/model"
)

const (
	TaskRiskBlocked = "blocked"
	TaskRiskOverdue = "overdue"
	TaskRiskDueSoon = "due_soon"
)

// DeriveTaskRisks is the single P0 source of truth for task risks.
// blocked is never persisted as task.status.
func DeriveTaskRisks(task model.Task, now time.Time) []string {
	if task.Status == "done" {
		return []string{}
	}

	risks := make([]string, 0, 3)
	for _, dependency := range task.Dependencies {
		if dependency.Status != "done" {
			risks = append(risks, TaskRiskBlocked)
			break
		}
	}

	if task.DueDate == nil || *task.DueDate == "" {
		return risks
	}

	due, ok := parseTaskDate(*task.DueDate)
	if !ok {
		return risks
	}
	today := time.Date(now.UTC().Year(), now.UTC().Month(), now.UTC().Day(), 0, 0, 0, 0, time.UTC)
	if due.Before(today) {
		return append(risks, TaskRiskOverdue)
	}
	if !due.After(today.Add(48 * time.Hour)) {
		return append(risks, TaskRiskDueSoon)
	}
	return risks
}

func parseTaskDate(value string) (time.Time, bool) {
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return parsed.UTC(), true
	}
	if parsed, err := time.Parse(time.RFC3339, value); err == nil {
		return time.Date(parsed.UTC().Year(), parsed.UTC().Month(), parsed.UTC().Day(), 0, 0, 0, 0, time.UTC), true
	}
	return time.Time{}, false
}

func DisplayTaskStatus(task model.Task) string {
	if task.Status == "done" {
		return "done"
	}
	for _, risk := range task.RiskTypes {
		if risk == TaskRiskBlocked {
			return "blocked"
		}
	}
	return task.Status
}

func AggregateRequirementProgress(tasks []model.Task) int {
	if len(tasks) == 0 {
		return 0
	}
	total := 0
	for _, task := range tasks {
		total += task.Progress
	}
	return total / len(tasks)
}

func SummarizeRequirementTasks(tasks []model.Task) (model.RequirementTaskSummary, model.RequirementRiskSummary) {
	taskSummary := model.RequirementTaskSummary{Total: len(tasks)}
	riskSummary := model.RequirementRiskSummary{}
	for _, task := range tasks {
		if task.Status == "done" {
			taskSummary.Done++
		}
		for _, risk := range task.RiskTypes {
			switch risk {
			case TaskRiskBlocked:
				taskSummary.Blocked++
				riskSummary.Blocked++
			case TaskRiskOverdue:
				riskSummary.Overdue++
			case TaskRiskDueSoon:
				riskSummary.DueSoon++
			}
		}
	}
	return taskSummary, riskSummary
}
