# CSS Variables Template

Complete `:root` token template. Copy and customise for each project.

## Full Template

```css
:root {
  /* ── Brand Colours ── */
  --primary: #hex;
  --primary-foreground: #hex;
  --secondary: #hex;
  --secondary-foreground: #hex;
  --accent: #hex;
  --accent-foreground: #hex;

  /* ── Semantic Colours ── */
  --background: #hex;
  --foreground: #hex;
  --card: #hex;
  --card-foreground: #hex;
  --muted: #hex;
  --muted-foreground: #hex;
  --border: #hex;

  /* ── Typography ── */
  --font-display: 'Display Font', system-ui, sans-serif;
  --font-body: 'Body Font', system-ui, sans-serif;

  /* ── Spacing Scale (4px base) ── */
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
  --space-20: 5rem;     /* 80px */
  --space-24: 6rem;     /* 96px */

  /* ── Border Radius ── */
  --radius-sm: 0.25rem;
  --radius: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* ── Shadows ── */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -2px rgba(0,0,0,0.05);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -4px rgba(0,0,0,0.04);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.05);
}
```

## Dark Mode Override

Only include if dark mode is enabled:

```css
.dark {
  /* ── Brand Colours (lighter/more saturated) ── */
  --primary: #hex;
  --primary-foreground: #hex;
  --secondary: #hex;
  --secondary-foreground: #hex;
  --accent: #hex;
  --accent-foreground: #hex;

  /* ── Semantic Colours ── */
  --background: #0F172A;
  --foreground: #F1F5F9;
  --card: #1E293B;
  --card-foreground: #F1F5F9;
  --muted: #334155;
  --muted-foreground: #94A3B8;
  --border: #334155;

  /* ── Shadows (stronger in dark mode) ── */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.2);
  --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.3), 0 2px 4px -2px rgba(0,0,0,0.2);
  --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.35), 0 4px 6px -4px rgba(0,0,0,0.2);
  --shadow-xl: 0 20px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.25);
}
```

## Token Pairing Rules

Every background token MUST have a paired foreground token:

| Background | Foreground | Use |
|------------|------------|-----|
| `--background` | `--foreground` | Page body |
| `--card` | `--card-foreground` | Cards, panels |
| `--muted` | `--muted-foreground` | Subtle backgrounds |
| `--primary` | `--primary-foreground` | Buttons, CTAs |
| `--secondary` | `--secondary-foreground` | Secondary actions |
| `--accent` | `--accent-foreground` | Highlights |

## Font Pairing Suggestions

| Category | Display | Body |
|----------|---------|------|
| Trades | Oswald, Barlow Condensed | Inter, Source Sans |
| Professional | Playfair Display, Cormorant | Lato, Open Sans |
| Hospitality | Libre Baskerville, DM Serif | DM Sans, Nunito |
| Creative | Space Grotesk, Syne | Work Sans, Outfit |
| Tech | JetBrains Mono, IBM Plex | IBM Plex Sans, Inter |

Load via Google Fonts with preconnect:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Display+Font:wght@300;700&family=Body+Font:wght@400;600&display=swap" rel="stylesheet">
```
