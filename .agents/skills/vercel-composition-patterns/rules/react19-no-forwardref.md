---
title: React 19 API Changes
impact: MEDIUM
impactDescription: cleaner component definitions and context usage
tags: react19, refs, context, hooks
---

## React 19 API Changes

> **⚠️ React 19+ only.** Skip this if you're on React 18 or earlier.

In React 19, `ref` can be a regular prop for new components. `useContext()` remains supported; `use()` is an alternative that also allows conditional context reads. Preserve existing APIs unless the current task benefits from changing them.

**Existing supported API (no automatic rewrite required):**

```tsx
const ComposerInput = forwardRef<TextInput, Props>((props, ref) => {
  return <TextInput ref={ref} {...props} />
})
```

**Correct (ref as a regular prop):**

```tsx
function ComposerInput({ ref, ...props }: Props & { ref?: React.Ref<TextInput> }) {
  return <TextInput ref={ref} {...props} />
}
```

**Supported context read:**

```tsx
const value = useContext(MyContext)
```

**Alternative when conditional reading is useful:**

```tsx
const value = use(MyContext)
```

`use()` can also be called conditionally, unlike `useContext()`.


Local API correction references: https://react.dev/reference/react/useContext and https://react.dev/reference/react/forwardRef
