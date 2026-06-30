package service

import "fmt"

const (
	DailyReportSkillSlug    = "aida-daily-report"
	DailyReportSkillVersion = "1.0.0"
	DailyReportSkillName    = "Aida 日报生成 Skill"
)

func DailyReportOutputContract() string {
	return `Return strict JSON only: {"report_markdown":"...","task_progress_suggestions":[{"task_id":"...","task_title":"...","requirement_id":"...","requirement_title":"...","suggested_status":"todo|in_progress|done","suggested_progress":0,"evidence_session_ids":["..."],"evidence_session_titles":["..."],"reason":"..."}]}. Do not invent facts outside the provided Aida context.`
}

func DailyReportSkillMarkdown(mcpURL string) string {
	return fmt.Sprintf(`# Aida Daily Report Skill

Use this skill when generating a personal daily report for Aida.

## Start Prompt Values

- urls: required. JSON array string of session or log URLs, for example ["https://aida.example.com/api/v1/sessions/<id>/log"].

## Required MCP

Bind the Aida Report MCP server:

%s

The MCP server requires an Aida user token in the Authorization header.

## Workflow

1. Call get_existing_report with report_type=personal_daily and period.date to fetch any existing report content.
2. Call get_sessions with scope.type=self and date_range covering the report date to list the user's sessions.
3. Call get_tasks with scope.type=self and the same date_range to list the user's tasks.
4. Call get_requirements with scope.type=self and the same date_range to list related requirements.
5. Use only facts returned by these atomic tools. Do not invent tasks, sessions, blockers, or progress.
6. Produce a concise Markdown daily report with these sections:
   - 今日完成
   - 阻塞风险
   - 明日计划
7. Return strict JSON matching the output contract.
8. If this run is allowed to save the report, call write_report_result with report_type=personal_daily, period.date, run_id, and the generated Markdown content.
9. If generation fails, call write_report_failure with run_id and error_message.

## Output Rules

- report_markdown must be non-empty Markdown.
- task_progress_suggestions is optional and must reference only task ids from the MCP context.
- Evidence session ids must come from the sessions returned by get_sessions.
- If there is insufficient context, say so in the Markdown instead of filling gaps.
`, mcpURL)
}
