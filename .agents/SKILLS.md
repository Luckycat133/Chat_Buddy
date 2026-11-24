# Curated Project Skill Routing

This repository keeps task-specific Skills in .agents/skills. Codex and Claude entry directories point to the same project-owned copies where links are present.

This table records the Skills reviewed or added by the 2026-09-11 audit; it does not remove or replace other project-owned Skills already present in the repository.

Load only the Skill whose trigger matches the current task. A Skill may be reused by several projects, and this project may use several Skills. Existing repository instructions and the user's current request take priority over a Skill.

| Skill | Use here for |
|---|---|
| `chat-buddy-web-demo-development` | Cloud-authoritative social behavior; implemented source/test routing in WEB_IMPLEMENTATION section 25 |
| `chat-buddy-drizzle-backend` | PostgreSQL + Drizzle schema/migrations (`db/`), PgBouncer `postgres.js` pooling, `server/` env/auth boundaries, and PGlite integration tests |
| `github-actions` | GitHub Actions workflow design, debugging, and hardening |
| `vercel-composition-patterns` | Compound React components and explicit variants; apply React 19 guidance only to code that benefits from it |
| `react-doctor` | React performance, rendering, and state health diagnostics |
| `tailwind-v4-shadcn` | Tailwind CSS v4 and shadcn/ui component styling conventions |
| `webapp-testing` | Browser verification using available browser tools or the repository Playwright suite |
| `ux-audit` | Structured user-experience, accessibility, and interaction flow audits |
| `ui-ux-pro-max` (global) | General UI/UX design system guidance via global skill (`~/.gemini/config/skills/ui-ux-pro-max`) |
| `distribution-publisher` (Claude Agent) | Dedicated agent (`~/.claude/agents/distribution-publisher.md`) for MCP/Skill registries, ClawHub, `skills.sh`, GEO/`llms.txt`, and launch copy |

## Maintenance rules

- Keep domain and implementation Skills in the project instead of the global Codex Skill directory.
- Preserve project-specific Skills as the source of truth; do not replace them with an archived global copy.
- Prefer links for IDE-specific discovery so Codex and Claude read the same maintained content.
- Add or expand a Skill only when it captures repeatable project knowledge that is not already clear from code or repository documentation.
- For small changes, run focused checks first and expand testing only when failures, risk, or new scope justify it.

## Source-based routing update — 2026-10-03

Start with the project-specific skill above for product/data/runtime work; load
UI, testing or architecture specialists only when that narrower task needs them.
The source maps record an inspection date, not a new runtime or deployment pass.

`webapp-testing` now uses available browser tools or the repository Playwright
suite; it no longer requires an Antigravity-only browser API.
