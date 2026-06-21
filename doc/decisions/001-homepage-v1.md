# Decision 001: Phase-One Role Homepage

| Field | Value |
| --- | --- |
| Status | Active decision |
| Date | 2026-06-21 |
| Scope | Aida phase-one homepage direction |
| Type | Product decision, not implementation spec |

## Decision

Phase one starts by freezing the role-based homepage.

The homepage is a role-specific workbench for Employee, TL, Director, and PM. It
is not a token dashboard, not a generic BI dashboard, and not a full project
management replacement.

The first implementation direction should adjust the current demo homepage
toward these fixed role templates. Requirement, task, AC, session, report, and
token pages can continue to exist as supporting pages, but phase one should not
begin by redesigning the whole task-management flow.

## Why This Is Frozen First

The homepage has the largest gap from the current demo and decides how users
understand Aida:

- If the homepage is token-first, Aida looks like usage analytics.
- If the homepage is task-first, Aida looks like a project-management tool.
- If the homepage is report-first, Aida looks like a reporting portal.
- If the homepage is role-workbench-first, Aida can validate its core value:
  helping each role quickly know what needs attention.

The requirement, task, and AC flow is less urgent to change for phase one. It is
already close enough to support homepage actions and detail drill-down.

## Homepage Principle

Each role homepage must answer one question within the first screen:

> What should I look at or handle now?

Token, Session, and report data are supporting evidence. They can explain work,
activity, and abnormal signals, but they must not dominate the homepage.

## Fixed Role Modules

| Role | Homepage main modules |
| --- | --- |
| Employee | Session upload, Feishu daily/weekly report, personal token, followed tasks |
| TL | Task breakdown + AC linkage, team report, member panel, team token, upstream attention items |
| Director | Requirement overview, department report, team activity, token trend, key followed requirements |
| PM | Key followed requirements, AC tracking, PM report, token distribution by requirement/model |

## Employee Homepage

The employee homepage is about personal execution and low-friction reporting.

Primary goals:

- Upload or bind Sessions for today's work.
- Confirm personal daily or weekly report status.
- See tasks followed by TL, PM, or Director.
- Understand whether someone is waiting for the employee's task output.
- View personal token usage only as supporting evidence.

Preferred first-screen emphasis:

1. Pending personal actions: Session upload, Session binding, report confirmation.
2. Followed tasks: who follows it, why it matters, deadline, missing evidence.
3. Personal evidence widget: today's Sessions and token summary.

Tone rule:

Use wording such as "complete work evidence", "confirm report draft", and
"support task progress". Avoid making the employee homepage feel like personal
surveillance.

## TL Homepage

The TL homepage is about team execution and attention from upper roles.

Primary goals:

- See requirements that need task breakdown.
- See tasks missing AC linkage.
- Review team daily or weekly reports.
- Scan member status, blockers, and missing work evidence.
- See PM or Director attention items affecting the team.
- View team token only as a supporting activity signal.

Preferred first-screen emphasis:

1. Upper-level attention and blocked team tasks.
2. Task breakdown and AC linkage gaps.
3. Team report review status.
4. Member panel.

## Director Homepage

The Director homepage is about department-level visibility and key risks.

Primary goals:

- See key requirements and their overall progress.
- See department report status.
- Compare team activity at a high level.
- Track token trend as background evidence.
- See high-attention requirements and cross-team risks.

Preferred first-screen emphasis:

1. Key followed requirements.
2. Requirement overview and risk ranking.
3. Department report and team activity.
4. Token trend as a right-side or secondary widget.

Privacy boundary:

The Director homepage should prefer department and team-level signals over
personal token surveillance.

## PM Homepage

The PM homepage is about requirement health, AC progress, and cross-team risk.

Primary goals:

- See key followed requirements.
- Track missing AC, AC progress, and AC-to-task gaps.
- See PM report status.
- Use token distribution by requirement/model to explain abnormal requirement
  progress.
- Identify cross-team blockers that need coordination.

Preferred first-screen emphasis:

1. Key followed requirements.
2. AC tracking.
3. Cross-team blockers.
4. Token distribution by requirement/model as supporting analysis.

## Demo Adjustment Direction

The current demo should be adjusted in this direction:

- Replace generic dashboard composition with fixed role homepage templates.
- Make each role's first screen visibly different.
- Reduce token and chart dominance.
- Make role actions more prominent than pure metrics.
- Keep requirement, task, AC, session, report, and token pages as supporting
  drill-down pages.
- Use a light drawer or detail panel for homepage item context.

## Explicit Non-Goals

This decision does not approve the following scope:

- Free-form configurable dashboard.
- Token-first data screen as the homepage.
- Full task-management redesign.
- Full requirement-management redesign.
- Full daily/weekly report system redesign.
- Real Feishu integration.
- Real external notification loop.
- Automatic assignment, scheduling, or priority changes.
- Gantt chart or resource planning.
- Personal token ranking as a management view.

## Open But Bounded Questions

These questions remain open, but they should not block homepage freezing:

- Exact fields inside each homepage module.
- Exact chart form for token trend or token distribution.
- Whether homepage clicks open a drawer or navigate to existing detail pages.
- Exact text and status naming for report-related modules.
- Exact risk threshold for missing Sessions, blockers, and no-progress items.

When these questions are answered, update this decision or create a new numbered
decision document. Do not infer answers from older historical drafts.
