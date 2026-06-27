# Hero Design Principles

The hero's job: Create an emotional first impression that reflects the brand personality.

## Questions to Answer Before Designing

Before writing any code, understand the context:

- **What's the single most important thing the visitor should feel?** (urgency? trust? luxury? excitement? capability?)
- **Does this business have strong visual assets?** (photos, product shots) or is it text-driven?
- **What action should the visitor take?** (call now? browse services? book online? read more?)
- **What device will most visitors use?** (mobile-first for trades, desktop-first for B2B)
- **What's the brand personality?** (formal? friendly? premium? accessible?)

## Approach Selection (Not Templates)

Choose your hero approach based on content and business type, not a template menu:

### Image-Dominant Heroes
**Best when:** Strong photography available, business sells an experience or visual result (hospitality, real estate, restaurants, galleries)

**Principles:**
- Let the image do the work — text should be minimal and purposeful
- One clear focal point in the image (don't split attention with busy compositions)
- Text placement should feel like it belongs IN the composition, not slapped ON TOP of it
- Consider whether the image needs the full viewport or just a portion
- The image should communicate something specific about the business, not just be "nice looking"

**What to avoid:**
- Generic stock photos that could be for any business
- Automatic dark overlays on every image (only use if truly needed for contrast)
- Centering text over images by default — consider natural negative space in the photo

### Typography-Dominant Heroes
**Best when:** No strong imagery available, brand voice is the differentiator, professional services, B2B

**Principles:**
- Typography IS the design — font choice, size, weight, spacing, and rhythm all matter more
- Create visual interest through dramatic typographic hierarchy (massive headline contrasting with small, refined subtitle)
- Use generous whitespace — the empty space IS the design element, not leftover area
- Consider colour blocking or subtle texture instead of photography
- The headline should be specific and opinionated, not generic marketing speak

**What to avoid:**
- Filling empty space with decorative elements "because it looks bare"
- Using stock photos just because you think every hero needs an image
- Safe, middle-of-the-road typography that doesn't make a statement

### Balanced Heroes (Split/Duo)
**Best when:** Both strong copy and strong imagery exist, need to convey information + emotion simultaneously

**Principles:**
- One side should still dominate slightly — true 50/50 splits feel indecisive and lack direction
- The image and text should relate to each other, not just coexist in proximity
- Consider which side gets attention first (reading direction, visual weight, colour contrast)
- On mobile, the order matters — which element should come first in the vertical stack?
- The split doesn't have to be vertical — consider horizontal divisions or asymmetric layouts

**What to avoid:**
- Using this approach by default for every hero
- Perfectly centered 50/50 splits with no visual hierarchy
- Text and image that have no relationship to each other

## Constraint-Based Creativity

### By Business Personality

Think about what the business FEELS like, not just what industry it's in:

**Emergency/urgent services** (plumbing, HVAC, locksmith, towing)
- Bold, high-contrast typography
- Phone number prominent and clickable
- Minimal decoration or artistic elements
- Action-oriented language
- Trust signals visible (licensed, insured, years in business)

**Luxury/hospitality** (high-end hotels, spas, fine dining, boutiques)
- Generous whitespace as a design feature
- Subtle, elegant typography
- Atmospheric full-bleed imagery
- Restrained colour palette
- Nothing shouty or urgent

**Trades/local services** (contractors, landscaping, cleaning, electricians)
- Real photos of actual work or team
- Credentials and certifications visible
- Service area/location prominent
- Action-oriented (clear next steps)
- Genuine, not overly polished

**Professional/corporate** (legal, financial, consulting, B2B)
- Clean, structured typography
- Restrained colour usage
- Professional but not stiff
- Clear value proposition
- Credibility indicators

**Creative/agency** (design studios, marketing, production, artists)
- Bold, unconventional choices
- Unusual composition or layout
- Personality-driven design
- Demonstrates capability through execution
- Breaks conventions purposefully

### By Available Assets

**Strong hero photo available** — Let it breathe. Don't shrink it into a 50% split if it deserves full width.

**Only team/staff photos** — Consider using as a smaller element, not forcing into the primary hero role.

**No usable photos** — Typography-led hero with colour/texture. Don't resort to generic stock photography.

**Generated/AI images** — Use more creatively — as texture, background elements, or partial reveals rather than literal hero placement.

**Product photography** — Consider whether to show products in context (lifestyle) or isolated (product-focused).

## What Makes a Hero Feel AI-Generated (Avoid These)

- Perfect centering of every element with no intentional asymmetry
- Dark gradient overlay on stock photo with white centered text
- Generic "Welcome to [Business Name]" headline
- All elements given equal visual weight
- Cookie-cutter split layout used regardless of content
- Decorative elements that serve no purpose
- CTA button that says "Learn More" or "Get Started"
- Three value proposition cards directly in the hero
- Everything aligned to a perfect grid with no intentional tension
- Typography that makes no statement

## What Makes a Hero Feel Human-Designed

- **One element clearly dominates** — either the image OR the text leads
- **Asymmetry or intentional visual tension**
- **A specific, opinionated headline**
- **Visual weight that guides the eye**
- **Feels custom-made for this business**
- **Whitespace used intentionally**
- **The CTA tells you exactly what happens**
- **Design choices you can explain**
- **Restraint**
- **Relationship between elements**

## Page-Specific Guidance

### Homepage Hero
- Most impactful hero, sets the entire site's tone
- Can be taller and more dramatic
- Should communicate the core brand promise immediately
- This is where you can take bigger design risks

### Interior Page Headers
- Simpler and faster to parse than homepage hero
- Don't repeat the homepage hero pattern
- Focus on orientation (where am I?) more than persuasion
- A strong headline and breadcrumb might be enough

### Service Pages
- Hero should immediately signal "you're in the right place for [specific service]"
- Be specific — not "Our Services" but "Commercial HVAC Installation & Maintenance"
- Include relevant trust signals and service-specific CTA

### About/Team Pages
- More personal, less sales-driven
- Consider editorial/magazine approaches
- Real photos matter more here than anywhere else

### Contact Pages
- Simplest hero — just needs to frame the form and provide context
- Include multiple contact methods visible immediately
- Don't use this hero to sell — they're already ready to contact you

## Common Implementation Patterns

### Split Hero Structure
```html
<section class="hero hero--split">
  <div class="container">
    <div class="hero__content">
      <h1 class="hero__title">[Specific, Opinionated Headline]</h1>
      <p class="hero__subtitle">[Supporting context]</p>
      <div class="hero__actions">
        <a href="/action" class="btn btn--primary btn--lg">[Specific CTA]</a>
      </div>
    </div>
    <div class="hero__image">
      <img src="[path]" alt="[Descriptive alt text]">
    </div>
  </div>
</section>
```

### Full-Width Image Hero Structure
```html
<section class="hero hero--full">
  <div class="hero__bg">
    <img src="[path]" alt="">
  </div>
  <div class="hero__overlay"></div>
  <div class="container">
    <div class="hero__content">
      <h1 class="hero__title">[Headline]</h1>
      <p class="hero__subtitle">[Subtitle]</p>
      <a href="/action" class="btn btn--primary btn--lg">[CTA]</a>
    </div>
  </div>
</section>
```

### Typography-Only Hero Structure
```html
<section class="hero hero--minimal">
  <div class="container">
    <div class="hero__content">
      <h1 class="hero__title">[Bold, Large Headline]</h1>
      <p class="hero__subtitle">[Contrasting smaller text]</p>
      <a href="/action" class="btn btn--primary btn--lg">[CTA]</a>
    </div>
  </div>
</section>
```

## Overlay Techniques for Text Readability

### Gradient Overlays (Directional)
```css
.hero__overlay {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.8) 0%,
    rgba(0, 0, 0, 0.4) 50%,
    transparent 100%
  );
}
```

### Brand-Tinted Overlays
```css
.hero__overlay {
  position: absolute;
  inset: 0;
  z-index: -1;
  background: rgba(var(--primary-rgb), 0.7);
}
```

### Text Shadow (Alternative to Overlay)
```css
.hero__title {
  text-shadow:
    0 2px 4px rgba(0, 0, 0, 0.3),
    0 4px 8px rgba(0, 0, 0, 0.2);
}
```

## Responsive Behaviour

```css
.hero__title {
  font-size: clamp(2rem, 6vw, 4rem);
}

/* Mobile: stack buttons vertically */
@media (max-width: 640px) {
  .hero__actions {
    flex-direction: column;
    gap: var(--space-4);
  }
  .hero__actions .btn {
    width: 100%;
  }
}

/* Split hero: stack on mobile */
@media (max-width: 768px) {
  .hero--split .container {
    grid-template-columns: 1fr;
  }
  .hero--split .hero__image {
    order: -1;
  }
}
```

## Dark Mode Considerations

```css
.hero__title { color: var(--foreground); }
.hero__subtitle { color: var(--muted-foreground); }

.dark .hero__overlay {
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.6) 50%,
    rgba(0, 0, 0, 0.3) 100%
  );
}

.dark .hero--minimal {
  background: var(--card);
}
```

## Execution Guidelines

1. **Start with content** — Write actual headline, subheadline, and CTA copy before designing
2. **Choose your dominant element** — Decide what leads based on the principles above
3. **Create hierarchy** — One thing most prominent, one thing second, everything else supports
4. **Design for mobile first** — The vertical stack forces you to prioritise
5. **Add desktop layout** — Enhance the mobile design, don't redesign from scratch
6. **Test contrast and readability** — Especially text over images
7. **Remove decoration** — Take away anything that doesn't serve the goal
8. **Check against anti-patterns** — Does this look like it came from a template?
