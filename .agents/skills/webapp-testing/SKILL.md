---
name: webapp-testing
description: Toolkit for interacting with and testing local web applications using Antigravity's built-in browser automation. Supports verifying frontend functionality, debugging UI behavior, capturing browser screenshots, and recording browser sessions.
license: Complete terms in LICENSE.txt
---

# Web Application Testing

Use Antigravity's built-in `browser_subagent` tool for all browser automation tasks. This is the preferred approach as it requires no external dependencies and automatically records sessions as WebP videos.

**Helper Scripts Available**:
- `scripts/with_server.py` - Manages server lifecycle (supports multiple servers)

**Always run scripts with `--help` first** to see usage. DO NOT read the source until you try running the script first and find that a customized solution is absolutely necessary. These scripts can be very large and thus pollute your context window. They exist to be called directly as black-box scripts rather than ingested into your context window.

## Core Tool: `browser_subagent`

The `browser_subagent` tool spawns a sub-agent that can interact with web pages. Key parameters:
- **TaskName**: Human-readable title (e.g., "Testing Login Flow")
- **Task**: Detailed instructions for what the sub-agent should do
- **RecordingName**: Name for the recorded video (e.g., "login_test")

## Decision Tree: Choosing Your Approach

```
User task → Is it static HTML?
    ├─ Yes → Read HTML file directly to identify selectors
    │         ├─ Success → Use browser_subagent with discovered selectors
    │         └─ Fails/Incomplete → Treat as dynamic (below)
    │
    └─ No (dynamic webapp) → Is the server already running?
        ├─ No → Use run_command to start the server first
        │        Or use scripts/with_server.py for managed lifecycle
        │        Then use browser_subagent for testing
        │
        └─ Yes → Reconnaissance-then-action:
            1. Navigate and wait for page to fully load
            2. Take screenshot or inspect DOM
            3. Identify selectors from rendered state
            4. Execute actions with discovered selectors
```

## Example: Using with_server.py

To start a server, run `--help` first, then use the helper:

**Single server:**
```bash
python scripts/with_server.py --server "npm run dev" --port 5173 -- python your_test_script.py
```

**Multiple servers (e.g., backend + frontend):**
```bash
python scripts/with_server.py \
  --server "cd backend && python server.py" --port 3000 \
  --server "cd frontend && npm run dev" --port 5173 \
  -- python your_test_script.py
```

## Example: Using browser_subagent for Testing

```
browser_subagent(
  TaskName: "Testing User Registration",
  Task: """
    1. Navigate to http://localhost:5173
    2. Wait for the page to fully load (all JS executed)
    3. Click the 'Sign Up' button
    4. Fill in the registration form:
       - Email: test@example.com
       - Password: TestPassword123
    5. Click 'Submit'
    6. Verify that a success message appears
    7. Take a screenshot of the final state
    8. Return whether the test passed or failed
  """,
  RecordingName: "registration_test"
)
```

## Reconnaissance-Then-Action Pattern

This is the **core testing methodology** - always discover before acting:

1. **Navigate and wait for full load**:
   ```
   Task: """
     1. Navigate to http://localhost:5173
     2. Wait for the page to fully load (network idle, JS executed)
     3. Take a full-page screenshot
     4. List all visible buttons, links, and input fields
     5. Return the discovered elements with their text/labels
   """
   ```

2. **Identify selectors** from the reconnaissance results

3. **Execute actions** using discovered selectors in a follow-up task

## Common Testing Patterns

### Form Validation Testing
```
Task: """
  1. Navigate to http://localhost:3000/login
  2. Wait for the page to fully load
  3. Leave email field empty, enter password
  4. Click submit and verify error message appears
  5. Enter invalid email format, verify validation error
  6. Enter valid credentials and verify successful login
"""
```

### Navigation Testing
```
Task: """
  1. Navigate to http://localhost:3000
  2. Wait for full page load
  3. Click each nav link and verify correct page loads
  4. Test browser back/forward buttons
  5. Verify all links work without 404 errors
"""
```

### Responsive Design Testing
```
Task: """
  1. Navigate to http://localhost:3000
  2. Resize browser to mobile width (375px)
  3. Wait for layout to adjust
  4. Verify mobile menu appears
  5. Resize to tablet (768px) and desktop (1200px)
  6. Capture screenshots at each breakpoint
"""
```

## Common Pitfalls

❌ **Don't** inspect the DOM before waiting for the page to fully load on dynamic apps
✅ **Do** always include "wait for the page to fully load" in your Task instructions

❌ **Don't** assume element selectors without reconnaissance
✅ **Do** take a screenshot or list elements first to discover actual selectors

## Best Practices

- **Use bundled scripts as black boxes** - Consider whether one of the scripts in `scripts/` can help. Use `--help` to see usage, then invoke directly.
- **Be specific in Task descriptions**: Include exact URLs, element text, and expected outcomes
- **Wait for page load**: Always instruct the sub-agent to wait for full page load before interacting
- **Use meaningful RecordingNames**: Videos are saved for later review
- **Start servers first**: Ensure the dev server is running before browser tests
- **Check results**: After browser_subagent returns, verify the reported outcome
- **Capture screenshots**: Request screenshots for visual verification and debugging

## Key Advantages

- ✅ No Python/Playwright dependencies required for basic tests
- ✅ Automatic session recording as WebP video
- ✅ Natural language task descriptions
- ✅ Built-in element discovery and interaction
- ✅ Works with any local or remote URL
- ✅ Helper scripts available for complex server management

## Reference Files

- **examples/** - Examples showing common patterns:
  - `element_discovery.py` - Discovering buttons, links, and inputs on a page
  - `static_html_automation.py` - Using file:// URLs for local HTML
  - `console_logging.py` - Capturing console logs during automation