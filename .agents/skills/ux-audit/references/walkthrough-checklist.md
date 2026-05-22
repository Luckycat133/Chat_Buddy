# UX Walkthrough Checklist

Evaluate each screen against these categories during a walkthrough. Based on Nielsen's usability heuristics, adapted for web apps.

## Per-Screen Evaluation

| Category | What to Check |
|----------|---------------|
| **First Impression** | Does the page orient me? Do I know what I can do here? |
| **Navigation** | Can I find what I need in 3 clicks or fewer? Is the current location clear? |
| **Labels & Icons** | Do they describe what they do? Would a first-time user understand them? |
| **Visual Hierarchy** | Is the most important information prominent? Is secondary info de-emphasised? |
| **Call to Action** | Is the primary action obvious? Are secondary actions visually distinct? |
| **Forms** | Are required fields marked? Is validation immediate and clear? Are error messages helpful? |
| **Feedback** | Does the app confirm my actions? Are there loading states? Success/error toasts? |
| **Error Recovery** | Can I undo mistakes? Is there a back button? Are destructive actions guarded? |
| **Consistency** | Same patterns used for similar features? Same terminology throughout? |
| **Data Display** | Tables sorted sensibly? Pagination? Empty states helpful? Long text truncated? |

## Cross-Cutting Checks

| Category | What to Check |
|----------|---------------|
| **Mobile (375px)** | Touch targets at least 44px. No horizontal scroll. Text readable. Forms usable. |
| **Dark Mode** | All text readable. No invisible elements. Borders/separators visible. Images appropriate. |
| **Keyboard** | Tab order logical. Focus indicators visible. Modals trap focus. Escape closes dialogs. |
| **Loading States** | Skeleton screens or spinners. No layout shift when data loads. Buttons disabled during submit. |
| **Empty States** | Helpful message when no data. Clear call to action to add first item. |

## Friction Scoring

When you find an issue, classify it:

| Severity | Definition | Example |
|----------|-----------|---------|
| **Critical** | User cannot complete their task | Submit button does nothing, form data lost |
| **High** | User is confused or takes wrong path | Unclear labels cause wrong selection, no undo on delete |
| **Medium** | User succeeds but with unnecessary effort | Required field not marked, have to scroll to find action |
| **Low** | Minor polish issue | Inconsistent capitalisation, alignment off by a few pixels |

## Walkthrough Questions

Ask these while walking through as a first-time user:

1. If I landed here with no training, would I know what to do first?
2. Can I complete the task without reading documentation?
3. When I click something, does the result match what I expected?
4. If I make a mistake, can I recover without losing work?
5. Would I feel confident using this in front of a colleague?
