# Aida Documents

This directory is the product documentation workspace for Aida.

## Current Status

Aida is moving from the current demo toward a phase-one product direction. The
current priority is to freeze the role-based homepage first, because it has the
largest gap from the demo and determines the product narrative.

The requirement, task, AC, session, report, and token flows are still important,
but they should not be redesigned before the homepage direction is stable.

## Source Of Truth

Read documents in this order:

1. `decisions/001-homepage-v1.md` - current confirmed homepage direction.
2. `aida-requirement-thinking.md` - historical direction-convergence draft.
3. `aida-platform-summary.md` - early broad product summary.
4. `prototypes/aida-p0-homepage/` - historical P0 homepage prototype.

For homepage-related work, `decisions/001-homepage-v1.md` takes precedence over
all older documents.

## Document Status

| Document | Status | Notes |
| --- | --- | --- |
| `decisions/001-homepage-v1.md` | Active decision | Use as the first source for homepage changes. |
| `aida-requirement-thinking.md` | Historical reference | Useful for context, but no longer the latest homepage decision. |
| `aida-platform-summary.md` | Historical reference | Broad early vision; do not treat every section as phase-one scope. |
| `prototypes/aida-p0-homepage/` | Historical prototype | Reference for role-homepage exploration, not an implementation contract. |

## Working Rule

Do not expand requirements from older documents unless a new decision document
explicitly revives them. When a topic is not covered by an active decision,
treat it as undecided instead of inferring scope from historical drafts.
