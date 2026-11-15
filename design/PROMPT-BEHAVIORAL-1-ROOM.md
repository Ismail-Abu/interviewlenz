# Build prompt 1 of 3 — Behavioral room shell

Paste everything below the line into a fresh chat with repo access.

---

You are redesigning the **behavioral round page** of Interviewlenz.
Repo: `https://github.com/Ismail-Abu/interviewlenz`, branch `main`.
Stack: Next.js 16.4.6 (App Router), TypeScript, Tailwind 4, Node 22.

Read `AGENTS.md` and `CURRENT.md` first. Branch: `f-behavioral-room`.

This is **1 of 3** parallel tasks. The others own `components/VoicePanel.tsx`
(task 2) and `components/ReportView.tsx` (task 3). **Do not edit those two
files** — you will collide.

## Your scope

- `components/BehavioralRoom.tsx` — the whole file is yours
- `components/behavioral/*` — new presentational components you create
- `app/globals.css` — tokens only, and only if they are not already there

Do not touch `app/api/**`, `lib/**`, `dev/**`, `scripts/**`, `.github/**`,
`components/VoicePanel.tsx`, or `components/ReportView.tsx`.

## The design decision for this page

The app is forced dark app-wide in `app/globals.css` (`color-scheme: dark`),
because it is shown on projectors and the Monaco editor is dark.

**The behavioral room has no editor, no code, no tests and no runs.** It is the
one in-app page that can go cream without fighting Monaco. Do that: make this
page cream, matching the landing page.

Scope the cream surface to this page's own wrapper. Do **not** change `body` or
the global theme — the coding room must stay exactly as it is.

## Design tokens

Add to `app/globals.css` **only if not already present** (the landing-page work
may have added them):

```css
@theme inline {
  --color-cream:        #FBF6EC;
  --color-cream-2:      #F6EEE0;
  --color-cream-3:      #F3E8D6;
  --color-ink:          #3A302C;
  --color-ink-muted:    #75665C;
  --color-maroon:       #9B3B50;
  --color-maroon-hover: #B04A60;
  --color-maroon-deep:  #8C2F43;
  --color-maroon-soft:  #C77D8C;
  --color-panel:        #1C1817;
  --color-panel-2:      #2A2422;
}
```

**Radius:** cards `rounded-[26px]`, panels `rounded-[30px]`, chips fully rounded.
**Elevation instead of borders** — drop `border border-zinc-800` and use a warm
shadow: `0 10px 18px -6px rgb(90 68 50 / 0.13)`. A grey/black shadow on cream
looks dirty.

Do not use `--color-brand-coral` (`#fe6b73`) on cream — ~2.1:1, fails contrast.
Note `turnLabel` currently returns `text-brand-coral` for the speaking state;
replace those tone classes with cream-safe ones (see below).

## What the page is

Read the current `components/BehavioralRoom.tsx` first. It renders:

- a header: `Wordmark`, "Behavioral round · Attempt N", a turns/answers counter,
  and a **Finish** button
- an optional "Tailored: …" line when `focusLabel` is set
- a **Current question** card showing the most recent interviewer turn, with an
  `aria-live="polite"` region
- a **whose turn it is** line driven by `turnLabel()`
- `<VoicePanel {...voice} />` (task 2 owns its internals — you own the wrapper
  around it)
- a tip line about describing the situation, what you did, and how you knew it
  worked

Keep every one of those. This is a visual redesign, not a feature change.

## Redesign brief

Make it feel like the landing page: cream surface, generous spacing, soft warm
shadows, large rounded cards, brown-black ink rather than pure black.

- **Header:** a rounded cream bar, not a bottom-bordered strip. Finish becomes a
  `btn.secondary` cream pill.
- **Current question:** the hero of the page. A large `rounded-[30px]` cream-2
  card with a soft shadow, the label in small letter-spaced maroon caps, and the
  question itself at ~22–24px with comfortable line height. It should read like
  someone asked you something, not like a form field.
- **Whose turn:** a pill under the question, with a small state dot. Cream-safe
  tones — suggested: connecting `#B07A1E`, interviewer speaking
  `--color-maroon`, your turn `#2E7D4F`, connection lost `#B3261E`, muted/idle
  `--color-ink-muted`. All of these clear 4.5:1 on cream; verify if you change
  them.
- **Voice panel wrapper:** a `rounded-[26px]` cream-2 container with the same
  soft shadow. Task 2 restyles the inside; you provide the frame and pass
  `tone="light"` (see "Coordination" below).
- **Tip line:** quieter — `--color-ink-muted`, smaller, with more space above.

Reference for the visual language: `design/concept-c-demo.png` and
`design/COVER-PAGE-BRIEF.md`, both already in the repo.

## Behaviour that must not change

Props, exactly as they are today:

```ts
voice: ComponentProps<typeof VoicePanel>
attemptNumber: number
focusLabel?: string
onFinish: () => void
```

`BehavioralRoom` is rendered by `components/ProblemRoom.tsx` (~line 596). Its
call site must keep working unchanged.

Keep the derivations: the current question is the **last interviewer turn** in
`voice.turns`; the counter is total turns and student-turn count; `turnLabel`
keys off `voice.connected`, `voice.state`, `voice.disconnected`, `voice.micOn`.

**These `data-testid` attributes are asserted by existing browser drivers — keep
every one, on an element that still does the same thing:**

`behavioral-room` · `session-stats` · `behavioral-focus` · `current-question` ·
`whose-turn`

Keep `aria-live="polite"` on the question region.

## Coordination with task 2

`VoicePanel` is shared with the coding room, so task 2 is giving it a
`tone?: "light" | "dark"` prop defaulting to `"dark"`. Pass `tone="light"` from
this page.

If task 2 has not landed when you build, render `<VoicePanel {...voice} />`
exactly as today and leave a `// TODO(task 2): pass tone="light"` comment. Do
not edit `VoicePanel.tsx` yourself.

## Responsive and accessibility

Works at 390px: header wraps, the question card keeps its padding, nothing
overflows horizontally. Body text ≥ 4.5:1, large text ≥ 3:1. Update
`:focus-visible` in `globals.css` from coral to `--color-maroon-soft` if the
landing work has not already.

## Verify

```bash
npm ci && npm run lint && npm run test:ci && npm run build
```

`npm run test:ci` runs 14 deterministic checks; none touch `components/**`, so
they must stay green. If one breaks you changed something out of scope.

Then `npm run dev`, start a behavioral round, and check at 1280px and 390px.

Open a PR against `main`. State that the coding room was left dark and that only
the behavioral page went cream.
