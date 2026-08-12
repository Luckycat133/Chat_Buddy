# Chat Buddy Test Coverage Strategy

> **Last verified**: 2026-08-12
>
> **Package**: 0.4.1
>
> **Test runner**: Vitest 4.1.10 with V8 coverage

## Current result

`TZ=UTC npm run test:coverage` is the CI quality gate. It covers the security,
data-integrity, chat-domain, rich-text, and shared utility modules that have
deterministic unit regressions.

| Metric | Verified | Gate |
| --- | ---: | ---: |
| Statements | 85.09% | 60% |
| Branches | 77.68% | 60% |
| Functions | 84.88% | 60% |
| Lines | 88.00% | 60% |

The run completed with 23 test files and 398/398 passing tests.

## Layered quality model

One percentage cannot accurately describe this browser application, so the
repository uses three explicit layers:

1. `npm run test:coverage` — a hard 60% gate for regression-critical unit logic.
2. `npm run test:coverage:all` — an observational report over every source file,
   with no threshold. The latest whole-repository values are 22.46% statements,
   19.53% branches, 17.57% functions, and 23.34% lines.
3. `npm run test:e2e -- --project=chromium` — rendered behavior and UX. The
   current suite passes 19/19 tests; the mobile UX project passes 8/8.

This split does not claim that the whole UI has high unit coverage. It keeps the
critical gate enforceable while Playwright and Axe verify the behavior that
line instrumentation cannot establish: routing, focus, keyboard use, touch
targets, responsive layout, reduced motion, accessible names, color contrast,
and the create-chat/send-message path.

## Gated modules

The unit gate includes:

- backup validation/import and API configuration;
- AIPipeline authorization and ChatEngine persistence/state transitions;
- chat normalization, polls, chat service, and tool authorization;
- Mermaid output hardening and message timeline rendering;
- input validation, sanitization, logging, time formatting, and RAG utilities.

When a high-risk module gains deterministic tests, add it to the gate rather
than lowering a threshold. UI-only modules should receive focused component
tests where useful and remain covered by the E2E acceptance suite.

## Commands

```bash
TZ=UTC npm run test:coverage
TZ=UTC npm run test:coverage:all
npm run test:e2e -- --project=chromium
npx playwright test e2e/ux.spec.js --project=mobile-chrome
```

Generated reports are written under `test_reports/coverage/`, which is ignored
by Git and excluded from ESLint and production builds.
