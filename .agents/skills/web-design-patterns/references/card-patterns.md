# Card Design Principles

A thinking framework for card-based layouts that don't look AI-generated.

**Philosophy**: Cards are containers that signal "this is a discrete, scannable unit." But not every group of items should be cards, and not all cards should look identical.

---

## 1. Card Design Fundamentals

### When to Use Cards (vs. Other Patterns)

**Use cards when**:
- Items are independent and self-contained (services, team members, pricing tiers)
- Users need to scan and compare discrete options
- Each item has 2-4 distinct pieces of information (title, description, CTA)

**Don't use cards when**:
- Content is sequential (use numbered lists or timeline)
- There's a single narrative flow (use article layout or alternating rows)
- Items have deep hierarchy within them (use accordion or tabs)
- You have a single item (just use a content block)

### Card Anatomy & Visual Hierarchy

Every card needs **clear internal hierarchy**. The eye should know where to look first, second, third.

**Hierarchy tools**:
1. **Size**: Larger elements draw attention
2. **Weight**: Bold stands out more than regular text
3. **Colour**: High contrast grabs attention
4. **Position**: Top-left gets read first in Western layouts
5. **Whitespace**: More space around = more important

**Typical card reading order**:
1. Image or icon — instant visual recognition
2. Title — what is this?
3. Description — why should I care?
4. Metadata — supporting details
5. CTA — what's the next action?

---

## 2. Layout Decision Framework

### Question 1: How Many Items? (MOST CRITICAL)

**2 items**: Side-by-side, equal weight OR one featured + one supporting
**3 items**: Featured + 2 secondary OR equal 3-column
**4 items**: Full-width featured + 3 below OR 2x2 grid
**5 items**: Bento with 2x2 featured OR 2+3 rows
**6 items**: Bento with 2x2 featured OR 3+3 rows
**7+ items**: Alternating rows OR simple responsive grid OR question if cards are the right pattern

**The orphan problem**: Never leave 1 card alone on a row.

**Safe layouts that work with ANY count**:
- Full-width featured card + responsive grid below
- Alternating full-width rows
- Simple responsive grid (1 col -> 2 col -> 3 col) that wraps naturally

### Question 2: Is There Hierarchy in Importance?

**When hierarchy exists**: Use featured card patterns
- Make the important card 2x the size
- Give it an image while others get icons
- Use a stronger CTA button (primary vs outline)

**When all items are equal**: Use uniform grid
- Same card dimensions for all
- Consistent internal structure

### Question 3: What's the Content Density?

**Image-heavy content**: 2-3 columns max, larger cards, less text per card
**Text-heavy content**: 3-4 columns, smaller cards, more content per card
**Mixed content**: Feature the image cards, icon-only cards can be denser

### Question 4: Where Does This Sit on the Page?

**Above the fold**: Fewer, larger cards (2-3 max)
**Mid-page**: More cards fine (4-6), simpler styling
**Near footer**: Simple grid or list, minimal decoration

---

## 3. Anti-Sameness Strategies

### Strategy 1: Vary Card Sizes Based on Importance

- **Primary offering**: 2x the size, includes image, detailed CTA
- **Secondary offerings**: Standard size, icon or small image
- **Tertiary offerings**: Compact cards or simple list items

### Strategy 2: Mix Card Formats Within a Section

**Service section example**:
- Card 1: Image + title + description + "Learn More" link
- Card 2: Icon + title + description + "View pricing" link
- Card 3: Large number/stat + title + brief text (no CTA)

### Strategy 3: Consider Non-Card Alternatives

**Alternatives to consider**:
- **Alternating rows**: Better for 3-5 detailed items with images
- **Numbered list**: Better for sequential steps or ranked items
- **Timeline**: Better for chronological content
- **Simple text blocks**: Better for benefits/features without images
- **Stats grid**: Better for number-heavy content
- **Icon list**: Better for simple feature lists

### Strategy 4: Vary Visual Treatment

Even if card structure is similar, vary the visual style:
- Some cards with images, some with icons, some with neither
- Some cards with subtle background, some with borders, some with shadows
- Different padding (featured card gets more breathing room)

---

## 4. Grid Math & Responsive Decisions

### Column Choice by Content Type

**2-column grid**: Image-heavy content, detailed comparisons. Works well for even counts.
**3-column grid**: Standard services, team members, blog posts. Watch for orphans with 4, 7, 10 items.
**4-column grid**: Compact cards, icon-based features, large datasets. Needs generous whitespace.

### Handling Orphan Items

**Solutions**:
1. Add a featured card that spans 2+ cells to adjust the math
2. Switch to alternating rows
3. Add/remove an item to reach grid-friendly count
4. Use responsive grid that wraps naturally
5. Make the last card full-width (intentional asymmetry)

### Responsive Breakpoints

**Desktop (>1024px)**: Full intended grid
**Tablet (768-1024px)**: Usually 2 columns regardless of desktop layout
**Mobile (<768px)**: Always 1 column (stacked)

---

## 5. Business Context Considerations

### Services
- Clear hierarchy (featured service if you have a specialty)
- 3-5 services max on one screen
- Strong CTAs on every card

### Team
- Founder/owner deserves featured treatment
- Real photos beat stock photos every time
- Include personality details, not just titles

### Pricing
- Always 2-3 tiers
- Highlight the recommended tier
- Align features for easy comparison
- Make CTA buttons at same vertical position

### Portfolio / Case Studies
- Minimise card chrome
- Images should be the hero
- Bento or masonry works well
- Brief text (title + client + link is enough)

### Features / Benefits
- Consider if cards are even needed (icon list might be better)
- Keep text minimal
- Grid can be denser (3-4 columns)

---

## 6. CSS Implementation Patterns

### Uniform Card Heights (Same Row)

```css
.card-grid {
  display: grid;
  gap: var(--space-8);
  grid-template-columns: repeat(2, 1fr);
  align-items: stretch;
}

.card {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.card__image {
  flex-shrink: 0;
}

.card__content {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  padding: var(--space-6);
}

.card__description {
  flex-grow: 1;
}

.card__tags {
  margin-top: auto;
}
```

**Why this works:**
1. Grid `align-items: stretch` — makes grid items fill their cell height
2. Card `height: 100%` — card expands to fill the stretched grid cell
3. Content `flex-grow: 1` — content area fills space between image and tags
4. Description `flex-grow: 1` — takes available space, pushing tags down
5. Tags `margin-top: auto` — anchors to the bottom of the flex container

---

## 7. Decision Flowchart

**Question 1: How many items?**
- 1 item -> Not a card, just a content block
- 2 items -> Equal cards side-by-side OR one featured + one supporting
- 3-6 items -> Continue to Question 2
- 7+ items -> Consider alternating rows OR simple grid

**Question 2: Is there clear hierarchy?**
- Yes -> Featured card pattern (make primary item 2x size)
- No, all equal -> Continue to Question 3

**Question 3: What's the content?**
- Image-heavy -> 2 columns or bento grid, larger cards
- Text-heavy -> 3-4 columns or alternating rows, smaller cards
- Mixed -> Featured pattern or varied card sizes

**Question 4: Check the grid math**
- Does your item count create orphans? -> Adjust grid

**Question 5: Does it look AI-generated?**
- All cards identical? -> Add size variation
- All same format? -> Mix image/icon/text cards
- Feels templated? -> Break the grid, add asymmetry

---

## 8. Quick Reference by Scenario

| Scenario | Item Count | Best Pattern | Key Principle |
|----------|-----------|-------------|---------------|
| Services (main offering clear) | 3-5 | Featured + grid | Show hierarchy |
| Services (all equal) | 4-6 | Simple 3-col grid | Clean and scannable |
| Services (detailed) | 3-4 | Alternating rows | Give descriptions space |
| Team (with founder) | 4-8 | Featured founder + grid | Leadership stands out |
| Team (all equal) | 6-9 | Simple 3-col grid | Keep personal |
| Pricing | 2-3 | 3-col with featured middle | Guide decision |
| Portfolio | 6-12 | Bento or masonry | Let work speak |
| Features | 6-12 | Dense 4-col or icon list | Fast scanning |
| Case studies | 3-6 | 2-col or alternating | Give detail space |
| Testimonials | 3-6 | Consider non-card pattern | Cards not ideal here |
