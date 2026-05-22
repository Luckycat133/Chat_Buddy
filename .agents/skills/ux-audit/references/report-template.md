# UX Audit Report Template

Use this template when writing audit reports to `docs/`.

## UX Walkthrough Report

```markdown
# UX Audit: [App Name]

**Date**: YYYY-MM-DD
**Scenario**: "[realistic task the user walked through]"
**Browser**: Chrome MCP / Playwright
**Viewport**: Desktop (1280px) + Mobile (375px)

## Summary

[2-3 sentences: overall impression, biggest concerns, what works well]

## Findings

### Critical (blocks user task)

- **[Short title]**: [What happened, what was expected]
  - *Where*: [page/component]
  - *Screenshot*: [filename if captured]
  - *Fix*: [concrete recommendation]

### High (causes confusion or friction)

- **[Short title]**: [description]
  - *Where*: [page/component]
  - *Fix*: [recommendation]

### Medium (suboptimal but workable)

- **[Short title]**: [description]
  - *Fix*: [recommendation]

### Low (polish)

- **[Short title]**: [description]

## What Works Well

- [Positive findings — patterns to preserve and replicate]

## Recommendations (priority order)

1. [Highest impact fix — addresses critical/high findings]
2. [Second priority]
3. [Third priority]
```

## QA Sweep Report

```markdown
# QA Sweep: [App Name]

**Date**: YYYY-MM-DD
**Browser**: Chrome MCP / Playwright
**Areas Tested**: [count]

## Summary

[passed] / [total] areas passed. [brief overview of failures]

## Results

| Area | Status | Issues |
|------|--------|--------|
| [Page/Feature] | Pass / Fail | [brief note or "—"] |

## Failed Areas — Detail

### [Area Name]

- **Issue**: [what failed]
- **Steps**: [how to reproduce]
- **Expected**: [what should happen]
- **Actual**: [what happened]

## Cross-Cutting

| Check | Status | Notes |
|-------|--------|-------|
| Dark mode | Pass/Fail | |
| Mobile (375px) | Pass/Fail | |
| Search & filters | Pass/Fail | |
| Notifications | Pass/Fail | |
| Empty states | Pass/Fail | |
```

## Guidelines

- Keep findings concrete — "Submit button doesn't respond" not "form is broken"
- Include page/route for every finding so developers can locate it
- Screenshots are optional but make critical/high findings much more actionable
- "What Works Well" section prevents the report from being only negative
- Priority recommendations should be actionable in one sprint
