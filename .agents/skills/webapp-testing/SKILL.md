---
name: webapp-testing
description: Verify Chat Buddy browser flows, responsive UI, loading/error states, and cloud-versus-local behavior using available browser tools or the repository Playwright suite. Use for visible UI regressions and end-to-end acceptance.
license: Complete terms in LICENSE.txt
---

# Chat Buddy Browser Verification

Use a browser tool actually available in the current agent, or the project's
installed Playwright suite. The former Antigravity-only `browser_subagent` API
is not a prerequisite and must not be assumed available. Follow each selected
tool's current documentation. Keep the existing helpers and license notices.

## Establish the tested mode

Read `package.json`, `playwright.config.js` and the relevant test. Record whether
this is the local compatibility app, mocked cloud UI, or a real local/hosted
backend. `VITE_USE_CLOUD=false` in the unit-test configuration does not exercise
a live server. Cloud-only behavior must be validated through the actual cloud
bridge and server consequence, not an optimistic browser render.

## Focused workflow

1. Reuse the task's running server/browser when appropriate; otherwise start the
   existing dev/test command and verify its actual URL. Do not guess port/state
   from historical screenshots or kill unrelated servers.
2. Inspect the rendered page and discover current elements before interacting.
   Wait for the relevant UI condition; chat streaming or long-lived connections
   may never reach network-idle.
3. Exercise the changed user action and the denied/error/empty state it affects.
   For persistence/sync, reload or reconnect and verify the actual saved result.
4. Capture visible evidence for a visual claim, plus relevant console/network
   failures. A screenshot cannot establish server authorization or hidden-data
   isolation; use the product skill's server tests for those boundaries.

From the repository root, `npm run test:e2e -- e2e/cloud-window.smoke.spec.js`
selects a relevant existing suite after its prerequisites are satisfied. Inspect
`e2e/p0-acceptance.spec.js` and `e2e/app.spec.js` for other supported flows.
Unit mocks, browser fixtures, and live accounts have separate evidence levels.
Use isolated fixtures for tests; do not send real social messages or spend model
quota merely to verify UI or skill changes.

If lifecycle automation is useful, inspect the bundled
[scripts/with_server.py](scripts/with_server.py) or read its `--help`; resolve it
from this skill directory, not a guessed root `scripts/` path. Only start/stop
servers owned by the test. Do not install another browser package when the
project's existing tooling suffices.

Save artifacts to the task/repository's established directory and report tested
URL, mode, action, result and remaining verification gap. Do not claim automatic
video recording or successful navigation without observing that output.
