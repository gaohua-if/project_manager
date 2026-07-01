package service

import "fmt"

const (
	ReportSkillSlug    = "aida-report"
	ReportSkillVersion = "1.0.0"
	ReportSkillName    = "Aida Report Skill"

	// Backward-compatible aliases for legacy draft code/tests. New Report Agent
	// configuration should use ReportSkill*.
	DailyReportSkillSlug    = ReportSkillSlug
	DailyReportSkillVersion = ReportSkillVersion
	DailyReportSkillName    = ReportSkillName
)

func DailyReportOutputContract() string {
	return `Return strict JSON only: {"report_markdown":"...","task_progress_suggestions":[{"task_id":"...","task_title":"...","requirement_id":"...","requirement_title":"...","suggested_status":"todo|in_progress|done","suggested_progress":0,"evidence_session_ids":["..."],"evidence_session_titles":["..."],"reason":"..."}]}. Do not invent facts outside the provided Aida context.`
}

func ReportSkillMarkdown(mcpURL string) string {
	return fmt.Sprintf(`# Aida Report Skill

Use this skill when generating Aida reports. The run input must include report_type, period, target, and run_id. Do not ask the user to provide session_ids, urls, MCP tokens, or credentials.

## Supported report_type

- personal_daily: current user's daily report.
- personal_weekly: current user's weekly report.
- team_daily: team daily report for the current user's allowed team scope.
- team_weekly: team weekly report for the current user's allowed team scope.
- department_daily: department daily report for the current user's allowed department scope.
- department_weekly: department weekly report for the current user's allowed department scope.

## Required MCP

Bind the Aida Report MCP server:

%s

The MCP server requires an Aida user token in the Authorization header.
The token is supplied by Aida through the AIDA_REPORT_MCP_AUTH credential slot at run time. Never ask the user for a token and never print credentials.

## Workflow

1. Read report_type, period, target, and run_id from the run input.
2. Call get_existing_report first to fetch any existing report content for the same report_type + period + target.
3. Select context tools by report_type:
   - personal_daily: get_sessions, get_tasks, get_requirements for scope.type=self and period.date.
   - personal_weekly: get_daily_reports, get_sessions, get_tasks, get_requirements for scope.type=self and the week range.
   - team_daily: get_daily_reports, get_sessions, get_tasks, get_requirements, get_report_inventory for the team daily scope.
   - team_weekly: get_weekly_reports, get_daily_reports, get_sessions, get_tasks, get_requirements, get_report_inventory for the team weekly scope.
   - department_daily: get_daily_reports, get_report_inventory, get_requirements for department daily scope.
   - department_weekly: get_weekly_reports, get_daily_reports, get_report_inventory, get_requirements for department weekly scope.
4. Use only facts returned by MCP tools. Do not invent tasks, sessions, blockers, progress, members, teams, or departments.
5. Produce concise Chinese Markdown suitable for the selected report_type.
6. Call write_report_result with the same report_type, period, target, run_id, and generated Markdown content.
7. If generation fails, call write_report_failure with report_type, period, target, run_id, and error_message.

## Output Rules

- The final report content must be non-empty Markdown.
- If there is insufficient context, say so in the Markdown instead of filling gaps.
- Missing daily/weekly reports are facts; include them only when relevant to the selected report type.
- Never expose run_id, MCP URLs, token, credential slots, or internal configuration in the user-facing report.
`, mcpURL)
}

func DailyReportSkillMarkdown(mcpURL string) string {
	return ReportSkillMarkdown(mcpURL)
}
