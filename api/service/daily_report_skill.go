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

Bind the Aida Daily Report MCP server:

%s

The MCP server requires an Aida user token in the Authorization header.

## Workflow

1. Call the MCP tool aida_daily_report_get_context with report_date.
2. Use only facts returned by the MCP context. Do not invent tasks, sessions, blockers, or progress.
3. Produce a concise Markdown daily report with these sections:
   - 今日完成
   - 阻塞风险
   - 明日计划
4. Return strict JSON matching the output contract from the MCP context.
5. If this run is allowed to save a draft, call aida_daily_report_save_draft with the generated Markdown and selected session ids.

## Output Rules

- report_markdown must be non-empty Markdown.
- task_progress_suggestions is optional and must reference only task ids from MCP context.
- Evidence session ids must come from the selected sessions in MCP context.
- If there is insufficient context, say so in the Markdown instead of filling gaps.
`, mcpURL)
}
