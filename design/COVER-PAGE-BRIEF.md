# Interviewlenz — cover page design brief

Handoff for the landing/cover page redesign. Self-contained: everything needed to
build any of the three concepts is in this file. Mockups sit beside it as
`concept-a-split.svg`, `concept-b-editorial.svg`, `concept-c-demo.svg`.

**Direction asked for:** beige base, LeetCode-like structure and buttons, hints of
burgundy.

---

## 1. What exists today (read this first)

The site currently has **one forced dark theme**. From `app/globals.css`:

```css
:root {
  --background: #09090b;   /* near-black */
  --foreground: #f4f4f5;
  color-scheme: dark;      /* deliberately does NOT follow the OS setting */
}
@theme inline {
  --color-brand:        #c8102e;  /* crimson */
  --color-brand-hover:  #dc1f3d;
  --color-brand-coral:  #fe6b73;
  --font-brand: var(--font-space-grotesk), ...;
}
```

The comment there explains why it is forced dark: *"the app is presented on
projectors and the editor is dark, so the page does not follow the OS light/dark
setting."*

Fonts already loaded in `app/layout.tsx`: **Space Grotesk** (brand/display),
**Geist Sans** (body), **Geist Mono** (code).

Buttons already centralised in `components/ui/buttons.ts` as `btn.primary`,
`btn.secondary`, `btn.neutral`.

Existing landing is `components/StartScreen.tsx`, with `components/landing/`
(`ResumeDrop`, `JobForm`, `TailorPanel`, `profile.ts`) and `components/Logo.tsx`
(`Wordmark`).

### The one real consequence of going beige

A beige page is a **light theme**, and the app's core surface — the Monaco code
editor in `components/CodeEditor.tsx` — is dark (`bg-[#1e1e1e]`). Two options,
pick one and be consistent:

- **(A) Beige marketing, dark app.** Cover page and setup go beige; the interview
  room stays dark. Cheapest, and the contrast reads as intentional — this is
  what LeetCode effectively does. **Recommended.**
- **(B) Beige everywhere.** Needs a light Monaco theme, re-tuned results/pass-fail
  colours, and a re-check of every `zinc-*` class in the room. Several hours and
  touches files well beyond the cover page.

Unless there is time to spare, do **(A)** and say so in the PR.

---

## 2. Palette, radius and elevation (ready to paste)

**Revision 2 — softer.** The beige is lighter so the page reads brighter, and the
maroon is lighter so it sits *on* the beige instead of punching through it.
Contrast is still AA everywhere it carries text.

```css
@theme inline {
  /* surfaces — warmer and lighter than r1 */
  --color-cream:        #FBF6EC;  /* page */
  --color-cream-2:      #F6EEE0;  /* cards, nav pill */
  --color-cream-3:      #F3E8D6;  /* chips, secondary buttons */
  --color-cream-line:   #EDE2D0;  /* hairlines (use sparingly — prefer no border) */

  /* ink — brown-black, never pure black */
  --color-ink:          #3A302C;  /* headings + body   (11.4:1 on cream) */
  --color-ink-muted:    #75665C;  /* secondary copy     (4.8:1 on cream) */

  /* maroon — lightened from #6E1026 */
  --color-maroon:       #9B3B50;  /* buttons, accents  (6.1:1 on cream, 6.7:1 w/ white text) */
  --color-maroon-hover: #B04A60;
  --color-maroon-deep:  #8C2F43;  /* link text on cream (7.0:1) */
  --color-maroon-soft:  #C77D8C;  /* underlines, tints — decorative only */

  /* the demo panel stays dark, but warm-dark, not neutral black */
  --color-panel:        #1C1817;
  --color-panel-2:      #2A2422;
}
```

Two things make it feel softer, and both matter more than the hues:

**Radius scale — go up a step everywhere.**

| Element | r1 | **r2** |
|---|---|---|
| Buttons | `rounded-md` 6px | **`rounded-[18px]`** |
| Cards / features | `rounded-lg` 10px | **`rounded-[26px]`** |
| Editor + demo panel | 14px | **`rounded-[30px]`** |
| Chips, nav pill, logo tiles | 6px | **fully rounded / `rounded-[24px]`** |

**Elevation instead of borders.** Drop most `border` lines and use one soft
warm shadow — a brown-tinted shadow on beige reads soft, a grey/black one reads
dirty:

```css
box-shadow: 0 10px 18px -6px rgb(90 68 50 / 0.13);   /* cards, buttons */
box-shadow: 0 12px 22px -6px rgb(90 68 50 / 0.14);   /* the dark demo panel */
```

### Buttons

Keep the exported names so no call site changes:

```ts
const base =
  "inline-flex items-center justify-center gap-2 rounded-[18px] font-semibold " +
  "text-[15px] px-6 py-4 transition-colors disabled:cursor-not-allowed disabled:opacity-60";

export const btn = {
  primary:   `${base} bg-maroon text-white shadow-[0_10px_18px_-6px_rgb(90_68_50/0.25)] hover:bg-maroon-hover`,
  secondary: `${base} bg-cream-3 text-maroon-deep hover:bg-[#EFE0CA]`,
  neutral:   `${base} text-ink-muted hover:text-ink hover:bg-cream-2`,
} as const;
```

Note the secondary button has **no border** now — it is a filled cream pill.
That single change does most of the softening work.

Do not reuse `--color-brand-coral` (`#fe6b73`) on cream: ~2.1:1, fails contrast.
Keep crimson `#c8102e` for the logo mark only.

---

## 2b. The company rail (new)

A horizontally scrollable row of company tiles, below the fold on every concept.

- **Tiles:** white `rounded-[24px]`, soft warm shadow, no border. White is what
  makes the logos pop against cream — a tinted tile muddies them.
- **Scroll:** native `overflow-x-auto` with `scroll-snap-type: x mandatory` and
  `snap-align: start` per tile. No JS carousel.
- **Affordance:** a cream gradient fade over the left and right 48–84px, plus a
  partially-cut tile at the right edge. Both mockups show this — it is what
  tells people it scrolls without an arrow button.
- **Scrollbar:** hide the native one (`scrollbar-width: none`) and show a thin
  custom track, or let the fade carry it. Keyboard: the row must be focusable
  and arrow-scrollable.
- **Mix:** big names and smaller ones together — Google, NVIDIA, Meta, Amazon,
  Microsoft, Stripe, Figma, Ramp, Vercel, Notion, Databricks, Linear.
- **Assets:** use real brand SVGs (e.g. the `simple-icons` set) rather than the
  letter stand-ins drawn in the mockups. Inline them so they can take
  `currentColor` where the brand allows a monochrome lockup.

**One caution.** Showing company logos on a landing page can read as
endorsement. Label the section *"Practice in the style of"* — never "trusted
by", "partnered with", or "our clients" — and do not claim the questions are
real leaked interview questions. That framing is honest, and it is also the
pitch you actually want.

---

## 3. The three concepts

### Concept A — "Split" (`concept-a-split.svg`)

The most LeetCode-like, and the closest to the sketch.

**Structure:** sticky beige nav (wordmark left; Practice / Problems / How it
works centre; burgundy *Start practice* right). Hero splits 50/50 — left is
headline, one-line subcopy, two buttons, and a small "no sign-up, runs Python in
your browser" line; right is a dark editor card tilted into the beige, showing
`contains_duplicate` with a green 4/4 results strip. Below the fold: a
three-column feature row, then a **problem table** styled like LeetCode's list
(Title / Difficulty / Topic / Status).

**Build:** `StartScreen.tsx` hero rewrite + new `components/landing/Nav.tsx`,
`FeatureRow.tsx`, `ProblemTable.tsx`. The editor card is a static mock — do
**not** mount Monaco on the landing page, it costs seconds of load.

**Effort:** ~3h. **Risk:** low. The problem table implies a problem bank; with
one problem today, show it with 3–4 "coming soon" rows greyed out, or cut the
table.

---

### Concept B — "Editorial" (`concept-b-editorial.svg`)

Quietest and most premium. Good if time is short — it is the least code.

**Structure:** generous beige field. Centred Space Grotesk headline at ~64px
with a burgundy brush underline under one word. One sentence of subcopy. A
single burgundy CTA plus a quiet text link. Below, one wide bordered screenshot
of the interview room, then a 3-step numbered row (Explain → Code → Get scored).

**Build:** `StartScreen.tsx` only, plus one screenshot asset. No new components.

**Effort:** ~1.5h. **Risk:** very low. Weakness: it shows the product later than
the other two, so the voice differentiator lands slower.

---

### Concept C — "Demo-first" (`concept-c-demo.svg`)

Leads with the thing nothing else does: the interviewer talking back.

**Structure:** full-height 45/55 split with no nav bar — just a wordmark
floating top-left. Left beige panel: headline, subcopy, CTA, and a row of three
small trust chips. Right: a full-bleed dark mock of the live room — editor on
top, transcript beneath with two speech bubbles (interviewer question in
burgundy-tinted bubble, student reply in grey) and a waveform. Nothing below the
fold; the page is one screen.

**Build:** `StartScreen.tsx` + `components/landing/LiveMock.tsx`. The transcript
bubbles can animate in with CSS only (staggered fade, no JS).

**Effort:** ~4h. **Risk:** medium — the mock must look real or it undersells.
Strongest demo-day impression of the three.

---

## 4. Recommendation

**Concept A**, with option (A) from §1 (beige marketing, dark app). It matches
the brief exactly, reuses the most existing markup, and its nav + button system
carries over to the rest of the site. If hours run short mid-build, it degrades
cleanly: drop the problem table and it becomes Concept B.

---

## 5. Acceptance checklist

- [ ] No `zinc-*` class left on the cover page; all surfaces use the new tokens
- [ ] `btn.primary/secondary/neutral` names unchanged, so no call site outside
      `buttons.ts` changes for the restyle
- [ ] Radius scale from §2 applied everywhere; logo mark keeps crimson `#c8102e`
- [ ] Body text ≥ 4.5:1 on its surface; large headings ≥ 3:1
- [ ] `:focus-visible` outline updated from coral to `--color-maroon-soft`
- [ ] Works at 390px wide (nav collapses, hero stacks, editor mock hides below `sm`)
- [ ] Monaco is **not** imported by the landing page
- [ ] `npm run lint` and `npm run build` pass
- [ ] `npm run test:ci` still green (14 checks — none touch components, so this
      should be unaffected; if it breaks, something outside the cover page changed)

---

## 6. Ownership note

`components/**` is Hamza's per `AGENTS.md`. The only shared file this touches is
`app/globals.css` (tokens). Nothing here needs a change to `lib/contract.ts`,
`app/api/**`, or any `dev/` check — so this work can land in parallel with
backend work on the report score and improvement links, with no conflicts.
