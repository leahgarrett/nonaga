# Nonaga Play Page — Design Spec

**Date:** 2026-05-08
**Status:** Approved

## Overview

A static, browser-only page that lets a human play Nonaga against any of the existing strategies. Reuses the strategy JSON configs from `strategies/configs/` as-is and ships under `play/` at the repo root, so it works locally via the existing Flask app and as a GitHub Pages site without any build step.

The Python engine and tournament code are untouched. The play page contains its own JavaScript port of the engine and strategy scorer.

---

## Game Rules (recap)

The play page implements the same rules as the engine in `engine/`:

- 2 players (Red and Black), 3 pawns each, 19 discs in a hex of radius 2.
- Red moves first. Initial pawns occupy the 6 corners alternating Red/Black.
- Each turn: slide a pawn in one of 6 directions until it hits the edge or another pawn (terminal disc only — no stopping early), then relocate one free edge disc to a new position that touches at least 2 remaining discs and is not the disc's own origin. The board must remain connected after removal.
- The opponent may not move the just-placed disc on their immediately following turn.
- Win: be first to have all 3 of your own pawns mutually neighbouring (line, triangle, or tick).

---

## Architecture & deployment

A single static page under `play/`, talking to the existing strategy JSON files in place. No bundler, no npm. ES modules served directly via `<script type="module">`.

```
play/
  index.html             — page shell (controls, board, move log)
  play.css               — local styles
  src/
    engine.js            — board, slide rule, win check, legal moves, applyMove
    strategies.js        — loadStrategy, scoreMove, pickMove
    game-tree.js         — tree of GameStates with parent links (branching scrubber)
    ui.js                — click handlers, highlights, controls, render glue
tests/play/
  test_engine.html       — open in browser; runs JS engine parity tests
```

Strategy configs are loaded with `fetch('../strategies/configs/<name>.json')`. No symlink, no copy — the configs ship in the repo and the relative path resolves correctly both when the Flask app serves the page and when GitHub Pages does.

The Flask app gains a tiny `/play` route that serves `play/index.html` for local dev parity. Pages serves the same file directly.

The board rendering helpers (`axialToPixel`, `renderBoard`) currently in `dashboard/static/board.js` are duplicated into `play/src/ui.js` (small enough to keep separate; sharing via `<script>` from another origin path on Pages is fragile). The dashboard's existing replay continues to use its own copy.

---

## JS engine port (`play/src/engine.js`)

A direct, line-by-line translation of the Python engine. Pure functions, no classes, no input mutation.

```js
export const HEX_DIRECTIONS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
// The 19 cells (q, r) with max(|q|, |r|, |q+r|) <= 2 — same set as
// engine/board.py:INITIAL_DISCS.
export const INITIAL_DISCS = /* Set<"q,r"> of the 19 hex cells */;
// Clockwise from (2,0): (2,0), (2,-2), (0,-2), (-2,0), (-2,2), (0,2)
// Same set as engine/board.py:INITIAL_CORNERS.
export const INITIAL_CORNERS;

export function hexDistance(a, b);
export function isAdjacent(a, b);
export function hexNeighbors(pos);
export function isConnected(discs);
export function edgeDiscs(discs);
export function removableDiscs(discs, occupied);
export function validPlacements(discs, excluded);

export function initialState(firstPlayer = "red");
export function applyMove(state, move);
export function checkWin(state);   // "red" | "black" | null

export function pawnDestinations(state, pawnPos);  // terminal disc only
export function legalMoves(state);
```

**State shape** (treated as immutable by convention; no deep-freeze):

```js
{
  discs: Set<"q,r">,                  // string keys for cheap Set membership
  redPawns: [[q,r], [q,r], [q,r]],
  blackPawns: [[q,r], [q,r], [q,r]],
  currentPlayer: "red" | "black",
  lastPlacedDisc: [q,r] | null,
}
```

**Move shape** mirrors the Python `Move` exactly:

```js
{ pawnIndex, pawnFrom, pawnTo, discFrom, discTo }
```

The slide-rule fix (only the terminal disc in each direction is a legal landing) is present in this port from day one.

---

## Strategy engine port (`play/src/strategies.js`)

Direct port of `strategies/engine.py`. Loads a JSON config, scores every legal move with the same heuristics, picks the highest-scoring one. Random tie-break uses a seeded RNG (`Math.random` by default; tests pass a deterministic one).

```js
export async function loadStrategy(name);   // fetch('../strategies/configs/<name>.json')
export function scoreMove(state, move, heuristics);
export function pickMove(state, strategyConfig, rng = Math.random);
```

Heuristic keys: `cluster_own`, `block_opponent`, `prefer_center`, `disc_help_self`, `disc_hurt_opp`, `randomness`. The `randomness` weight is honoured during AI play — strategies are used exactly as they appear in the tournament.

The strategy picker in `index.html` is a hard-coded `<option>` list of the seven existing configs (`aggressive`, `defensive`, `disc-sculptor`, `disruptor`, `pure-center`, `random`, `speedrunner`). Adding a new strategy means adding one `<option>` element.

---

## Game tree & branching scrubber

The scrubber is a tree, not a list, because "play from here" creates a new branch.

```js
class GameTree {
  root: Node                 // initial state
  current: Node              // node currently shown on the board
}

Node = {
  state: GameState,
  move: Move | null,         // the move that produced this state
  parent: Node | null,
  children: Node[],
  mainline: Node | null,     // the child to follow on next/last
}
```

**Behaviour:**

- Playing a move (human or AI) appends a child to `current` and advances `current` to it. If `current` already had children (the user scrubbed back and made a different move), the new move becomes a new child *and* the new `mainline`; old branches are kept, not deleted.
- **first / prev / next / last** walk along `current.parent` and `current.mainline`.
- **"Play from here"**: viewing a non-leaf node and clicking your own pawn commits a new move at that node, creating a branch. No explicit button — the click IS the branch.
- **Move log** shows the mainline from root to the deepest descendant of `current`, with `current`'s row highlighted. Off-mainline branches are not displayed.
- **Scrubbing into AI's turn**: the scrubber buttons (first/prev/next/last) still navigate the tree as usual — `next` advances along `mainline` and replays the AI's recorded move. The board just doesn't accept clicks at an AI-turn node, since the user only controls their own pawns. So "view-only" means input-disabled, not navigation-disabled.

Memory is not a concern — games end in at most 200 turns and humans branch sparingly.

---

## Page layout

Single page, three regions, no routing.

```
┌─────────────────────────────────────────────────────────┐
│ Nonaga — Play                                           │
│ [Strategy ▾ pure-center] [Color ▾ Red] [New game]       │
├──────────────────────────┬──────────────────────────────┤
│                          │ Move log                     │
│         [SVG board]      │ T1 red:  pawn[0] (2,0)→…     │
│                          │ T1 black:…                   │
│                          │ T2 red: …  ← current         │
│                          │ …                            │
│  [⏮  ⏪  ⏩  ⏭]         │ Hint □                        │
│  Turn 7 of 12 — your turn│                              │
│  Status: pick a pawn     │                              │
└──────────────────────────┴──────────────────────────────┘
```

- **Strategy / Color selectors**: changing them mid-game is disabled. "New game" is the only way to switch.
- **Color default flips between games**: after a game ends, the next game's default colour is the opposite of what was just played, so the human alternates between going first (Red) and going second (Black). Manual override available.
- **Game over banner** replaces the status line ("You won!" / "AI won — pure-center caught you in a tick"). Scrubber remains usable; "New game" becomes prominent.

---

## Interaction state machine

The board's click behaviour is driven by a small state machine (matches the "stage-then-confirm" interaction model — every move is previewed before it commits).

| State | Trigger | Highlights shown |
|---|---|---|
| `idle` | start of human turn | own pawns get a soft outline; on hover (if Hint is on) the pawn's legal slide destinations preview faintly |
| `pawn-selected` | clicked a pawn | same pawn outlined bold; legal slide destinations highlighted as click targets |
| `pawn-staged` | clicked a destination | ghost pawn shown at destination; original pawn dimmed; **removable discs** highlighted |
| `disc-staged` | clicked a removable disc | that disc fades / is gone; **valid placement spots** highlighted |
| `confirm` | clicked a placement spot | ghost disc shown at placement; "Confirm turn" + "Cancel" buttons appear |
| → `idle` | clicked "Confirm" | move is applied to the tree, AI plays, view advances |
| → `pawn-selected` (or earlier) | clicked another own pawn or "Cancel" | unwinds staging cleanly |

**During AI's turn**: status reads "AI thinking…", input controls disabled. Scrubber buttons remain enabled. A 200 ms minimum delay before the AI move animates in so the transition is visible.

**Hint checkbox**: only affects the `idle` state — on hover over your pawns, faintly preview their slide destinations. Doesn't reveal the AI's move, doesn't change anything else.

---

## Testing

Two layers, both static so they ship with the page.

**Layer 1 — JS engine parity** (`tests/play/test_engine.html`): a plain HTML file that imports `engine.js`, runs assertions in the browser, and dumps pass/fail to the page. Mirrors the Python tests in `tests/engine/`:

- 19 discs, 6 corners alternating, no overlap.
- `pawnDestinations` returns only terminal positions (slide-rule case identical to the Python test).
- `removableDiscs` excludes occupied positions and keeps the board connected.
- `validPlacements` requires ≥ 2 disc neighbours and excludes the disc's origin.
- `checkWin` recognises line, triangle, tick — not spread.
- `legalMoves` from the initial state returns the same count as the Python engine (570). This is the cross-language parity guard.

**Layer 2 — strategy smoke** (same harness): one full game with a fixed RNG seed and `random` strategy as both players. Asserts the game terminates, the winner is in `{red, black, draw}`, and every recorded move was legal at the time it was played.

**Not tested:** click-by-click UI flow (manual; state machine is small), pixel-perfect rendering (existing replay validates that path), strategy "correctness" (the tournament is that test).

CI integration is out of scope for now. A future GitHub Action can run the tests in headless Chromium if it becomes worth it.

---

## Out of scope

- Two-human local play.
- Online multiplayer.
- Saving / loading games.
- New strategies authored from inside the page.
- Mobile-specific touch UX (the click flow should work on touch by virtue of being click-based, but no special accommodation).
- AI-thinking visualisations (move scores, considered alternatives).
