package service

import (
	"testing"
	"time"

	"github.com/aidashboard/api/model"
)

func testReportDraftSessions() []model.ReportDraftSession {
	start := time.Date(2026, 6, 24, 9, 30, 0, 0, time.UTC)
	return []model.ReportDraftSession{
		{ID: "session-1", AgentType: "claude_code", StartedAt: start},
		{ID: "session-2", AgentType: "codex", StartedAt: start.Add(2 * time.Hour)},
	}
}

func testReportDraftTasks() []model.ReportDraftTaskCandidate {
	return []model.ReportDraftTaskCandidate{
		{
			TaskID:           "task-1",
			TaskTitle:        "控制台日报交互设计",
			RequirementID:    "req-1",
			RequirementTitle: "日报入口状态优化",
			CurrentStatus:    "in_progress",
			CurrentProgress:  40,
			Owner:            "张三",
		},
	}
}

func TestValidateDraftSkillID(t *testing.T) {
	if err := ValidateDraftSkillID(DefaultDailyReportSkillID); err != nil {
		t.Fatalf("default skill should be valid: %v", err)
	}
	if err := ValidateDraftSkillID(""); err != nil {
		t.Fatalf("empty skill should use default: %v", err)
	}
	if err := ValidateDraftSkillID("other"); err == nil {
		t.Fatalf("unsupported skill should fail")
	}
}

func TestNormalizeDraftResponse(t *testing.T) {
	resp := model.GenerateReportDraftResponse{
		ReportMarkdown: "# 日报",
		TaskProgressSuggestions: []model.TaskProgressSuggestion{
			{
				TaskID:             "task-1",
				SuggestedStatus:    "in_progress",
				SuggestedProgress:  120,
				EvidenceSessionIDs: []string{"session-1", "unknown", "session-1"},
				Reason:             "有明确 session 证据",
			},
		},
	}

	got := NormalizeDraftResponse(resp, testReportDraftSessions(), testReportDraftTasks(), true)
	if got.SkillName != DefaultDailyReportSkillName {
		t.Fatalf("skill name = %q", got.SkillName)
	}
	if len(got.SelectedSessionIDs) != 2 || got.SelectedSessionIDs[0] != "session-1" {
		t.Fatalf("selected session ids = %#v", got.SelectedSessionIDs)
	}
	if len(got.TaskProgressSuggestions) != 1 {
		t.Fatalf("suggestions len = %d, want 1", len(got.TaskProgressSuggestions))
	}
	item := got.TaskProgressSuggestions[0]
	if item.SuggestedProgress != 100 {
		t.Fatalf("progress = %d, want 100", item.SuggestedProgress)
	}
	if item.TaskTitle != "控制台日报交互设计" || item.RequirementID != "req-1" {
		t.Fatalf("task metadata not normalized: %#v", item)
	}
	if len(item.EvidenceSessionIDs) != 1 || item.EvidenceSessionIDs[0] != "session-1" {
		t.Fatalf("evidence ids = %#v", item.EvidenceSessionIDs)
	}
}

func TestNormalizeDraftResponseIncludeFalse(t *testing.T) {
	resp := model.GenerateReportDraftResponse{
		ReportMarkdown: "# 日报",
		TaskProgressSuggestions: []model.TaskProgressSuggestion{
			{TaskID: "task-1", SuggestedStatus: "done", SuggestedProgress: 100, EvidenceSessionIDs: []string{"session-1"}},
		},
	}
	got := NormalizeDraftResponse(resp, testReportDraftSessions(), testReportDraftTasks(), false)
	if len(got.TaskProgressSuggestions) != 0 {
		t.Fatalf("suggestions should be empty when includeTaskProgress=false")
	}
}

func TestNormalizeDraftResponseFiltersInvalidSuggestions(t *testing.T) {
	resp := model.GenerateReportDraftResponse{
		ReportMarkdown: "# 日报",
		TaskProgressSuggestions: []model.TaskProgressSuggestion{
			{TaskID: "missing", SuggestedStatus: "done", SuggestedProgress: 100, EvidenceSessionIDs: []string{"session-1"}},
			{TaskID: "task-1", SuggestedStatus: "blocked", SuggestedProgress: 80, EvidenceSessionIDs: []string{"session-1"}},
			{TaskID: "task-1", SuggestedStatus: "in_progress", SuggestedProgress: 80, EvidenceSessionIDs: []string{"unknown"}},
		},
	}
	got := NormalizeDraftResponse(resp, testReportDraftSessions(), testReportDraftTasks(), true)
	if len(got.TaskProgressSuggestions) != 0 {
		t.Fatalf("invalid suggestions should be filtered: %#v", got.TaskProgressSuggestions)
	}
}
