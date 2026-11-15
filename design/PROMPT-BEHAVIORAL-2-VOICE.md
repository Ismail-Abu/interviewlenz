# Build prompt 2 of 3 — Voice panel and transcript

Paste everything below the line into a fresh chat with repo access.

---

You are redesigning the **voice panel and live transcript** of Interviewlenz.
Repo: `https://github.com/Ismail-Abu/interviewlenz`, branch `main`.
Stack: Next.js 16.4.6 (App Router), TypeScript, Tailwind 4, Node 22.

Read `AGENTS.md` and `CURRENT.md` first. Branch: `f-voice-panel`.

This is **2 of 3** parallel tasks. The others own `components/BehavioralRoom.tsx`
(task 1) and `components/ReportView.tsx` (task 3). **Do not edit those two
files** — you will collide.

## Your scope

- `components/VoicePanel.tsx` — the whole file is yours
- `components/voice/*` — new presentational components you create
- `app/globals.css` — tokens only, and only if they are not already there

Do not touch `app/api/**`, `lib/**`, `dev/**`, `scripts/**`, `.github/**`,
`components/BehavioralRoom.tsx`, `components/ProblemRoom.tsx`, or
`components/ReportView.tsx`.

## The constraint that defines this task

**`VoicePanel` is shared by both rooms.**

- The **coding room** (`ProblemRoom.tsx`) is dark and stays dark — Monaco is
  dark and the app is demoed on projectors.
- The **behavioral room** (task 1) is going cream.

So this panel has to look right on two different surfaces. Add a prop:

```ts
tone?: "light" | "dark";   // default "dark"
```

`"dark"` must render **visually identical to today** — the coding room should
see no change at all. `"light"` is the new cream treatment. Drive it with token
pairs inside the component, not with conditional markup; the DOM structure
should be the same in both tones so the browser drivers behave identically.

If you prefer, implement it as a CSS-variable scope (`data-tone="light"` on the
root with the vars redefined beneath it) rather than branching class strings.
Either is fine; what matters is one DOM, two palettes.

## Design tokens

Add to `app/globals.css` **only if not already present**:

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

**Radius:** chat bubbles `rounded-[22px]`, controls fully rounded, container
`rounded-[26px]`. **Elevation instead of borders** on the light tone:
`0 10px 18px -6px rgb(90 68 50 / 0.13)`.

Do not use `--color-brand-coral` (`#fe6b73`) on cream — ~2.1:1, fails contrast.
It may stay in the dark tone.

## What the panel is

Read `components/VoicePanel.tsx` first. It renders the live interview controls
and transcript: a connect / start control, a **mic mute toggle** with
`aria-pressed`, a **Reconnect** button when the connection drops, a **state
indicator** (a coloured dot plus text in an `aria-live="polite"` region) for
connecting / listening / speaking / idle / error, a **MOCK VOICE** badge when
running without an API key, and the scrolling **transcript** of
`TranscriptTurn`s.

Keep all of it. This is a visual redesign, not a feature change.

## Redesign brief

- **Transcript as a conversation, not a log.** Chat bubbles at
  `rounded-[22px]`: the interviewer's turns in maroon with near-white text, left
  aligned; the student's turns in a neutral surface, right-offset. In the light
  tone the student bubble is `--color-cream-3` with ink text; in the dark tone
  it stays as it is today. Give the two speakers a small letter-spaced caps
  label, as in `design/concept-c-demo.png`.
- **State indicator as a pill** with the dot inside it, rather than loose text.
  Cream-safe tones for the light surface — suggested: connecting `#B07A1E`,
  speaking `--color-maroon`, listening `#2E7D4F`, error `#B3261E`, idle
  `--color-ink-muted`. All clear 4.5:1 on cream; verify if you change them.
- **Mic toggle** as a round maroon button when live, with a clear muted state.
  It must stay a real toggle with `aria-pressed` — do not swap it for two
  separate buttons.
- **Reconnect** as a prominent but not alarming button; the "connection lost"
  message should read as recoverable, not as a crash.
- **Auto-scroll** to the newest turn, but do not fight the user: if they have
  scrolled up, leave them there. Keep the scroll container keyboard-focusable.

Reference for the visual language: `design/concept-c-demo.png` and
`design/COVER-PAGE-BRIEF.md`, both already in the repo.

## Behaviour that must not change

This panel sits on a live WebSocket session. The surrounding logic — connect,
reconnect, mic start/stop, turn delivery — lives in `components/liveAdapter.ts`,
`lib/live.ts` and `ProblemRoom.tsx`, and is **not yours**. Keep the props
exactly as they are and keep calling the same handlers.

In particular, do not change how often the component re-renders on new turns,
and do not add state that could drop or reorder a `TranscriptTurn`. Turn IDs are
unique and continuous across a reconnect; render them in the order given.

**These `data-testid` attributes are asserted by existing browser drivers — keep
both, on elements that still do the same thing:**

`reconnect` · `mock-voice-badge`

Also keep `aria-pressed` on the mic toggle and `aria-live="polite"` on the state
region. Several dev checks and browser drivers assert reconnect behaviour, mute
persistence across reconnect, and that no second mic starts — a markup change
must not disturb any of it.

## Responsive and accessibility

Works at 390px: bubbles wrap, controls stay reachable, no horizontal overflow.
Body text ≥ 4.5:1 on **both** tones — check the light one specifically, it is
the easy one to get wrong. Respect `prefers-reduced-motion` for any bubble
entrance animation.

## Verify

```bash
npm ci && npm run lint && npm run test:ci && npm run build
```

`npm run test:ci` runs 14 deterministic checks. Several exercise the Live client
(`live-reconnect`, `live-disconnect`, `live-transcript`, `live-turnid`,
`live-run-evidence`). They stub the provider and do not render React, so they
should stay green — if one breaks, you changed something outside this component.

Then `npm run dev` and check **both** rooms: the coding room must look
unchanged, and the behavioral room must look right in the light tone.

Open a PR against `main`. State explicitly that the dark tone is pixel-unchanged
for the coding room, and say how you verified it.
