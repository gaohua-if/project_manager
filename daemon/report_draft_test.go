package main

import (
	"strings"
	"testing"
	"time"
)

func testDraftRequest(includeTaskProgress bool) reportDraftGenerateRequest {
	start := time.Date(2026, 6, 24, 9, 30, 0, 0, time.UTC)
	end := start.Add(50 * time.Minute)
	return reportDraftGenerateRequest{
		UserID:              "user-1",
		UserName:            "张三",
		ReportDate:          "2026-06-24",
		IncludeTaskProgress: includeTaskProgress,
		Sessions: []reportDraftSession{
			{
				ID:         "session-1",
				SessionRef: "ref-1",
				AgentType:  "claude_code",
				StartedAt:  start,
				EndedAt:    &end,
				Summary:    "完成 Dashboard 日报弹窗接入",
			},
			{
				ID:         "session-2",
				SessionRef: "ref-2",
				AgentType:  "codex",
				StartedAt:  start.Add(2 * time.Hour),
				Summary:    "补充任务进展建议",
			},
		},
		TaskCandidates: []reportDraftTaskCandidate{
			{
				TaskID:           "task-1",
				TaskTitle:        "控制台日报交互设计",
				RequirementID:    "req-1",
				RequirementTitle: "日报入口状态优化",
				CurrentStatus:    "in_progress",
				CurrentProgress:  40,
				Owner:            "张三",
			},
		},
	}
}

func TestParseReportDraftOutputValidJSON(t *testing.T) {
	raw := `{
		"report_markdown": "# 6 月 24 日日报\n\n## 今日完成\n完成接入\n\n## 风险与阻塞\n暂无\n\n## 明日计划\n继续验证",
		"task_progress_suggestions": [
			{
				"task_id": "task-1",
				"task_title": "模型输出标题会被后端候选覆盖",
				"requirement_id": "bad",
				"requirement_title": "bad",
				"suggested_status": "in_progress",
				"suggested_progress": 125,
				"evidence_session_ids": ["session-1", "not-selected", "session-1"],
				"evidence_session_titles": ["bad"],
				"reason": "session 明确提到完成接入"
			}
		]
	}`

	got, err := parseReportDraftOutput(raw, testDraftRequest(true))
	if err != nil {
		t.Fatalf("parseReportDraftOutput() error = %v", err)
	}
	if got.ReportMarkdown == "" {
		t.Fatalf("report markdown should not be empty")
	}
	if len(got.SelectedSessionIDs) != 2 || got.SelectedSessionIDs[0] != "session-1" {
		t.Fatalf("selected session ids = %#v", got.SelectedSessionIDs)
	}
	if len(got.TaskProgressSuggestions) != 1 {
		t.Fatalf("task suggestions len = %d, want 1", len(got.TaskProgressSuggestions))
	}
	suggestion := got.TaskProgressSuggestions[0]
	if suggestion.SuggestedProgress != 100 {
		t.Fatalf("progress = %d, want clamped 100", suggestion.SuggestedProgress)
	}
	if len(suggestion.EvidenceSessionIDs) != 1 || suggestion.EvidenceSessionIDs[0] != "session-1" {
		t.Fatalf("evidence ids = %#v", suggestion.EvidenceSessionIDs)
	}
	if suggestion.TaskTitle != "控制台日报交互设计" || suggestion.RequirementID != "req-1" {
		t.Fatalf("candidate metadata was not restored: %#v", suggestion)
	}
}

func TestParseReportDraftOutputCodeFence(t *testing.T) {
	raw := "```json\n" + `{"report_markdown":"# 6 月 24 日日报\n\n## 今日完成\n完成\n\n## 风险与阻塞\n暂无\n\n## 明日计划\n暂无","task_progress_suggestions":[]}` + "\n```"
	got, err := parseReportDraftOutput(raw, testDraftRequest(true))
	if err != nil {
		t.Fatalf("parseReportDraftOutput() error = %v", err)
	}
	if !strings.Contains(got.ReportMarkdown, "今日完成") {
		t.Fatalf("unexpected markdown: %q", got.ReportMarkdown)
	}
}

func TestParseReportDraftOutputInvalidJSON(t *testing.T) {
	if _, err := parseReportDraftOutput("not json", testDraftRequest(true)); err == nil {
		t.Fatalf("expected invalid JSON error")
	}
}

func TestParseReportDraftOutputEmptyMarkdown(t *testing.T) {
	raw := `{"report_markdown":"","task_progress_suggestions":[]}`
	if _, err := parseReportDraftOutput(raw, testDraftRequest(true)); err == nil {
		t.Fatalf("expected empty report_markdown error")
	}
}

func TestParseReportDraftOutputIncludeTaskProgressFalse(t *testing.T) {
	raw := `{
		"report_markdown":"# 6 月 24 日日报\n\n## 今日完成\n完成\n\n## 风险与阻塞\n暂无\n\n## 明日计划\n暂无",
		"task_progress_suggestions":[{"task_id":"task-1","suggested_status":"done","suggested_progress":100,"evidence_session_ids":["session-1"]}]
	}`
	got, err := parseReportDraftOutput(raw, testDraftRequest(false))
	if err != nil {
		t.Fatalf("parseReportDraftOutput() error = %v", err)
	}
	if len(got.TaskProgressSuggestions) != 0 {
		t.Fatalf("task suggestions should be empty when include_task_progress=false")
	}
}

func TestParseReportDraftOutputFiltersInvalidSuggestions(t *testing.T) {
	raw := `{
		"report_markdown":"# 6 月 24 日日报\n\n## 今日完成\n完成\n\n## 风险与阻塞\n暂无\n\n## 明日计划\n暂无",
		"task_progress_suggestions":[
			{"task_id":"missing-task","suggested_status":"done","suggested_progress":100,"evidence_session_ids":["session-1"]},
			{"task_id":"task-1","suggested_status":"blocked","suggested_progress":80,"evidence_session_ids":["session-1"]},
			{"task_id":"task-1","suggested_status":"in_progress","suggested_progress":80,"evidence_session_ids":["missing-session"]}
		]
	}`
	got, err := parseReportDraftOutput(raw, testDraftRequest(true))
	if err != nil {
		t.Fatalf("parseReportDraftOutput() error = %v", err)
	}
	if len(got.TaskProgressSuggestions) != 0 {
		t.Fatalf("invalid suggestions should be filtered, got %#v", got.TaskProgressSuggestions)
	}
}
