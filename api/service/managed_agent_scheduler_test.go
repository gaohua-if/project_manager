package service

import (
	"testing"
	"time"

	"github.com/aidashboard/api/model"
)

func TestIsManagedAgentScheduleDueDaily(t *testing.T) {
	now := time.Date(2026, 6, 26, 19, 5, 0, 0, time.UTC)
	schedule := model.ManagedAgentSchedule{
		Enabled:      true,
		ScheduleType: "daily",
		TimeOfDay:    "19:00",
		Timezone:     "UTC",
	}
	if !IsManagedAgentScheduleDue(schedule, now) {
		t.Fatalf("daily schedule should be due after configured time")
	}
}

func TestIsManagedAgentScheduleDueWeekly(t *testing.T) {
	now := time.Date(2026, 6, 26, 19, 5, 0, 0, time.UTC) // Friday
	schedule := model.ManagedAgentSchedule{
		Enabled:      true,
		ScheduleType: "weekly",
		Weekdays:     []int{5},
		TimeOfDay:    "19:00",
		Timezone:     "UTC",
	}
	if !IsManagedAgentScheduleDue(schedule, now) {
		t.Fatalf("weekly schedule should be due on configured weekday")
	}

	schedule.Weekdays = []int{4}
	if IsManagedAgentScheduleDue(schedule, now) {
		t.Fatalf("weekly schedule should not be due on other weekdays")
	}
}

func TestIsManagedAgentScheduleDueSkipsSameLocalDay(t *testing.T) {
	now := time.Date(2026, 6, 26, 19, 5, 0, 0, time.UTC)
	last := time.Date(2026, 6, 26, 19, 1, 0, 0, time.UTC)
	schedule := model.ManagedAgentSchedule{
		Enabled:      true,
		ScheduleType: "daily",
		TimeOfDay:    "19:00",
		Timezone:     "UTC",
		LastRunAt:    &last,
	}
	if IsManagedAgentScheduleDue(schedule, now) {
		t.Fatalf("schedule should not run twice on the same local day")
	}
}
