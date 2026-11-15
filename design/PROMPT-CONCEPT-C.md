# Build prompt — Interviewlenz cover page, Concept C

Paste everything below the line into a fresh chat with repo access.

---

You are implementing a redesign of the Interviewlenz landing page ("Concept C").
Repo: `https://github.com/Ismail-Abu/interviewlenz`, branch `main`.
Stack: Next.js 16.4.6 (App Router), TypeScript, Tailwind 4, Node 22.

Read `AGENTS.md` and `CURRENT.md` first. Work on one branch, e.g. `f-cover-c`.

## Scope

**Only the landing page and its design tokens.** Do not touch `app/api/**`,
`lib/**`, `dev/**`, `scripts/**`, or `.github/**`. No backend or contract change
is needed for this task.

Files you will touch:
- `components/StartScreen.tsx` (the landing page)
- `components/landing/*` (new presentational components)
- `components/ui/buttons.ts`
- `app/globals.css` (tokens only)

## The one architectural decision

`app/globals.css` currently forces a single dark theme for the whole app:

```css
:root { --background: #09090b; --foreground: #f4f4f5; color-scheme: dark; }
```

The comment explains why — the app is shown on projectors and the Monaco editor
is dark. **Do not make the whole app light.** Implement "beige marketing, dark
app": the landing page is cream, the interview room stays exactly as it is.
Scope the cream surface to the landing page's own wrapper, not to `body`.

Also: **do not import or mount Monaco on the landing page.** The editor shown in
the design is a static mock made of divs and `<pre>`; mounting the real editor
costs seconds of load.

## Design tokens — add to `app/globals.css`

```css
@theme inline {
  --color-cream:        #FBF6EC;  /* page */
  --color-cream-2:      #F6EEE0;  /* cards */
  --color-cream-3:      #F3E8D6;  /* chips, secondary buttons */

  --color-ink:          #3A302C;  /* headings + body, brown-black not pure black */
  --color-ink-muted:    #75665C;  /* secondary copy */

  --color-maroon:       #9B3B50;  /* buttons, accents */
  --color-maroon-hover: #B04A60;
  --color-maroon-deep:  #8C2F43;  /* link text on cream */
  --color-maroon-soft:  #C77D8C;  /* underlines, decorative only */

  --color-panel:        #1C1817;  /* the demo panel: warm dark, not black */
  --color-panel-2:      #2A2422;
}
```

Keep crimson `#c8102e` for the logo mark only. Do **not** use the existing
`--color-brand-coral` (`#fe6b73`) on cream — it is ~2.1:1 and fails contrast.

**Radius:** buttons `rounded-[18px]`, cards `rounded-[26px]`, panels
`rounded-[30px]`, chips and logo tiles fully rounded / `rounded-[24px]`.

**Elevation instead of borders.** Remove borders; use one warm brown-tinted
shadow. A grey/black shadow on cream looks dirty.

```
cards + buttons:  0 10px 18px -6px rgb(90 68 50 / 0.13)
dark demo panel:  0 12px 22px -6px rgb(90 68 50 / 0.14)
```

## Buttons — rewrite `components/ui/buttons.ts`

Keep the exported names `btn.primary`, `btn.secondary`, `btn.neutral` so no call
site outside this file changes. Move sizing into `base`.

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

The secondary button has **no border** now — a filled cream pill. That single
change does most of the softening.

## Layout — Concept C

Desktop, two columns, roughly 45 / 55.

**Left column (cream):**
1. Wordmark top-left (existing `Wordmark` from `components/Logo.tsx`).
2. A pill badge: small maroon dot + `LIVE VOICE INTERVIEW`, 11.5px, bold,
   letter-spaced, on `cream-3`.
3. Headline, ~47px bold, three lines: "It asks you / the **follow-up** /
   question." — "follow-up" in maroon with a soft `maroon-soft` underline bar at
   ~38% opacity sitting behind the text baseline.
4. Three lines of muted body copy.
5. Primary button "Start practice" + secondary "Behavioral round →".
6. A row of three fully-rounded cream chips: "No sign-up", "Python in your
   browser", "Free".

**Right column — an inset, rounded dark panel** (not full-bleed; it floats on
the cream with a margin and `rounded-[30px]`), containing:
1. A mock editor card: title bar with `solution.py · v4` and a small maroon
   "▶ Run" pill; seven lines of syntax-highlighted Python (`contains_duplicate`
   using a set); a green `v4 — 4 / 4 passed` pill bottom-right.
2. A `TRANSCRIPT` label with a green "listening" dot on the right.
3. Three chat bubbles, `rounded-[22px]`: interviewer (maroon, left), you (dark
   grey, right-offset), interviewer (maroon, left). Use the copy from the mockup.

**Below both columns — the company rail** (full width):
- Heading "Practice in the style of" + a `Browse all →` link on the right.
- A horizontally scrollable row of **white** `rounded-[24px]` tiles, each with a
  full-colour company logo and the name beneath. White tiles are deliberate: a
  tinted tile muddies brand colours.
- Native `overflow-x-auto` with `scroll-snap-type: x mandatory` and
  `snap-align: start` per tile. **No JS carousel.**
- Affordance: a cream gradient fade over the left and right edges (~48–84px),
  and let the last tile be partially cut off. That is what signals it scrolls.
- Hide the native scrollbar (`scrollbar-width: none`); the row must still be
  keyboard-focusable and arrow-scrollable.
- Mix big and small: Google, NVIDIA, Meta, Amazon, Microsoft, Stripe, Figma,
  Ramp, Vercel, Notion, Databricks, Linear.
- Use real brand SVGs from `simple-icons` (add it as a dependency, or inline the
  paths). Do not ship hand-drawn letter stand-ins.
- Label it **"Practice in the style of"**. Never "trusted by", "partnered with",
  or "our clients" — showing logos can read as endorsement, and do not claim the
  questions are real leaked interview questions.

The reference mockup is `design/concept-c-demo.png` in the repo, and
`design/COVER-PAGE-BRIEF.md` has the full token set.

## Behaviour that must not change

`StartScreen` is wired into `ProblemRoom.tsx`. Preserve its props exactly:

```ts
micStatus: MicStatus
onMicStatus: (s: MicStatus) => void
onStart: (profile: CandidateProfile, mode: PracticeMode, context?: BehavioralContext) => void
```

Keep all of this working: the mic check on entry (`checkMicrophone`), the setup
section with `ResumeDrop`, `JobForm` and `TailorPanel`, and all three practice
modes (coding, behavioral, full mock).

**These `data-testid` attributes are asserted by existing browser drivers — keep
every one, on an element that still does the same thing:**

`hero-start-practice` · `start-practice` · `skip-behavioral` · `start-coding` ·
`start-behavioral` · `start-full-mock` · `setup-summary` · `mic-status`

Keep the section ids `#practice-modes` and `#setup` so in-page anchors still work.

## Responsive

Works at 390px wide: columns stack, the dark demo panel sits below the text (or
hides below `sm` if it crowds), the chip row wraps, the company rail still
scrolls. No horizontal page scroll at any width.

## Accessibility

- Body text ≥ 4.5:1 on its surface; large headings ≥ 3:1. The tokens above
  satisfy this — verify if you change them.
- Update the `:focus-visible` outline in `globals.css` from coral `#fe6b73` to
  `--color-maroon-soft`.
- The company rail is a labelled, focusable region.

## Verify before you finish

```bash
npm ci
npm run lint
npm run test:ci
npm run build
```

`npm run test:ci` runs 14 deterministic checks. None of them touch
`components/**`, so they must stay green — if one breaks, you changed something
outside the cover page.

Then run `npm run dev` and check the page at 1280px and at 390px.

Open a PR against `main` describing what changed, and note explicitly that the
interview room was left dark.
