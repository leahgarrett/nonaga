# Nonaga Play Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, browser-only Nonaga page where a human can play against any of the seven existing strategies, deployable as-is to GitHub Pages.

**Architecture:** A single static page under `play/` with a JS port of the Python engine (`engine.js`), a JS port of the strategy scorer (`strategies.js`), a tree-shaped move history with branching scrubber (`game-tree.js`), and a click-driven UI with stage-then-confirm interaction (`ui.js`). Strategy configs are fetched in place from `strategies/configs/*.json` — no symlinks, no copies, no build step.

**Tech Stack:** Plain ES modules served via `<script type="module">`. No npm, no bundler, no framework. Tests run as a self-contained HTML file opened in a browser.

**Spec:** `docs/superpowers/specs/2026-05-08-nonaga-play-page-design.md`

---

## File map

**Create:**
- `play/index.html` — page shell
- `play/play.css` — styles
- `play/src/engine.js` — board, slide rule, win check, legal moves
- `play/src/strategies.js` — config loader, scorer, picker
- `play/src/game-tree.js` — branching move history
- `play/src/ui.js` — click handlers, rendering, controls
- `tests/play/test_engine.html` — browser test runner for engine + strategies + game-tree
- `tests/play/test_runner.js` — tiny assert/report helper
- `tests/play/test_engine.js` — engine assertions
- `tests/play/test_strategies.js` — strategy smoke
- `tests/play/test_game_tree.js` — game-tree assertions

**Modify:**
- `dashboard/app.py` — add `GET /play` route serving `play/index.html` for local dev parity
- `README.md` — short "Play in browser" section pointing at `play/index.html`

---

## Task 1: Test harness

A minimal browser test runner. Subsequent tasks rely on this to express their TDD cycle.

**Files:**
- Create: `tests/play/test_runner.js`
- Create: `tests/play/test_engine.html`

- [ ] **Step 1: Write the test runner**

`tests/play/test_runner.js`:

```js
const results = [];

export function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, err: err.message || String(err) });
  }
}

export function assert(cond, msg = "assertion failed") {
  if (!cond) throw new Error(msg);
}

export function assertEqual(actual, expected, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  expected: ${e}\n  actual:   ${a}`);
}

export function assertSetEqual(actual, expected, msg = "") {
  const a = [...actual].sort();
  const e = [...expected].sort();
  assertEqual(a, e, msg);
}

export function report() {
  const root = document.getElementById("results");
  const passed = results.filter(r => r.ok).length;
  root.innerHTML =
    `<h2>${passed}/${results.length} passed</h2>` +
    results.map(r =>
      `<div class="${r.ok ? 'ok' : 'fail'}">${r.ok ? '✓' : '✗'} ${r.name}` +
      (r.ok ? '' : `<pre>${r.err}</pre>`) + `</div>`
    ).join("");
}
```

- [ ] **Step 2: Write the harness HTML**

`tests/play/test_engine.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>Nonaga play tests</title>
<style>
  body { font: 14px/1.4 system-ui, sans-serif; padding: 1rem; }
  .ok { color: #2a7a2a; }
  .fail { color: #b22; }
  pre { background: #f4f4f4; padding: .5rem; }
</style>
<h1>Nonaga play tests</h1>
<div id="results">Running…</div>
<script type="module">
  import { report } from "./test_runner.js";
  // Each test module pushes results when imported.
  await import("./test_engine.js").catch(e => console.error(e));
  await import("./test_strategies.js").catch(e => console.error(e));
  await import("./test_game_tree.js").catch(e => console.error(e));
  report();
</script>
```

- [ ] **Step 3: Stub the test modules so the harness loads**

`tests/play/test_engine.js`:

```js
import { test } from "./test_runner.js";
test("placeholder", () => {});
```

`tests/play/test_strategies.js` and `tests/play/test_game_tree.js`: same single-line `test("placeholder", () => {})`.

- [ ] **Step 4: Run the harness**

```
python3 -m http.server 8000 --directory .
```

Open `http://localhost:8000/tests/play/test_engine.html`. Expected: "3/3 passed".

- [ ] **Step 5: Commit**

```bash
git add tests/play/
git commit -m "test: scaffold browser test harness for play page"
```

---

## Task 2: Engine — constants and board predicates

Port `engine/board.py` to `play/src/engine.js`. Pure helpers only, no game state yet.

**Files:**
- Create: `play/src/engine.js`
- Modify: `tests/play/test_engine.js`

- [ ] **Step 1: Write failing tests**

Replace `tests/play/test_engine.js` with:

```js
import { test, assert, assertEqual, assertSetEqual } from "./test_runner.js";
import {
  HEX_DIRECTIONS, INITIAL_DISCS, INITIAL_CORNERS,
  hexNeighbors, hexDistance, isAdjacent,
  isConnected, edgeDiscs, removableDiscs, validPlacements,
  key, parseKey,
} from "../../play/src/engine.js";

test("HEX_DIRECTIONS has 6 entries", () => {
  assertEqual(HEX_DIRECTIONS.length, 6);
});

test("INITIAL_DISCS has 19 cells", () => {
  assertEqual(INITIAL_DISCS.size, 19);
});

test("INITIAL_CORNERS has 6 cells, all in INITIAL_DISCS", () => {
  assertEqual(INITIAL_CORNERS.size, 6);
  for (const k of INITIAL_CORNERS) assert(INITIAL_DISCS.has(k));
});

test("hexNeighbors of origin returns 6 unit-distance cells", () => {
  const ns = hexNeighbors([0, 0]).map(key);
  assertSetEqual(ns, ["1,0", "1,-1", "0,-1", "-1,0", "-1,1", "0,1"]);
});

test("hexDistance basics", () => {
  assertEqual(hexDistance([0, 0], [0, 0]), 0);
  assertEqual(hexDistance([0, 0], [1, 0]), 1);
  assertEqual(hexDistance([0, 0], [2, 0]), 2);
  assert(isAdjacent([0, 0], [1, 0]));
  assert(!isAdjacent([0, 0], [2, 0]));
});

test("isConnected: single, adjacent pair, non-adjacent pair, full board", () => {
  assert(isConnected(new Set(["0,0"])));
  assert(isConnected(new Set(["0,0", "1,0"])));
  assert(!isConnected(new Set(["0,0", "2,0"])));
  assert(isConnected(INITIAL_DISCS));
});

test("edgeDiscs subset of discs, excludes (0,0), includes corners", () => {
  const e = edgeDiscs(INITIAL_DISCS);
  for (const k of e) assert(INITIAL_DISCS.has(k));
  assert(!e.has("0,0"));
  for (const k of INITIAL_CORNERS) assert(e.has(k));
});

test("removableDiscs excludes occupied and keeps board connected", () => {
  const occupied = INITIAL_CORNERS;
  const r = removableDiscs(INITIAL_DISCS, occupied);
  for (const k of r) {
    assert(!occupied.has(k));
    const remaining = new Set(INITIAL_DISCS);
    remaining.delete(k);
    assert(isConnected(remaining));
  }
});

test("validPlacements: touches >=2 discs, not in remaining, excludes origin", () => {
  const remaining = new Set(INITIAL_DISCS);
  remaining.delete("2,0");
  const places = validPlacements(remaining, [2, 0]);
  for (const k of places) {
    assert(!remaining.has(k));
    assertEqual(k === "2,0", false);
    const [q, r] = parseKey(k);
    const count = hexNeighbors([q, r]).filter(n => remaining.has(key(n))).length;
    assert(count >= 2);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Reload `test_engine.html`. Expected: imports fail because `play/src/engine.js` doesn't exist yet.

- [ ] **Step 3: Implement engine.js (board predicates)**

`play/src/engine.js`:

```js
export const HEX_DIRECTIONS = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

export function key(pos) { return `${pos[0]},${pos[1]}`; }
export function parseKey(k) {
  const [q, r] = k.split(",").map(Number);
  return [q, r];
}

function buildInitialDiscs() {
  const out = new Set();
  for (let q = -2; q <= 2; q++)
    for (let r = -2; r <= 2; r++)
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= 2)
        out.add(`${q},${r}`);
  return out;
}
export const INITIAL_DISCS = buildInitialDiscs();

export const INITIAL_CORNERS = new Set([
  "2,0", "2,-2", "0,-2", "-2,0", "-2,2", "0,2",
]);

export function hexNeighbors(pos) {
  const [q, r] = pos;
  return HEX_DIRECTIONS.map(([dq, dr]) => [q + dq, r + dr]);
}

export function hexDistance(a, b) {
  const dq = b[0] - a[0], dr = b[1] - a[1];
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(dq + dr));
}

export function isAdjacent(a, b) { return hexDistance(a, b) === 1; }

export function isConnected(discs) {
  if (discs.size === 0) return true;
  const start = discs.values().next().value;
  const visited = new Set([start]);
  const stack = [parseKey(start)];
  while (stack.length) {
    const pos = stack.pop();
    for (const n of hexNeighbors(pos)) {
      const k = key(n);
      if (discs.has(k) && !visited.has(k)) {
        visited.add(k);
        stack.push(n);
      }
    }
  }
  return visited.size === discs.size;
}

export function edgeDiscs(discs) {
  const out = new Set();
  for (const k of discs) {
    const pos = parseKey(k);
    if (hexNeighbors(pos).some(n => !discs.has(key(n)))) out.add(k);
  }
  return out;
}

export function removableDiscs(discs, occupied) {
  const out = new Set();
  for (const k of edgeDiscs(discs)) {
    if (occupied.has(k)) continue;
    const remaining = new Set(discs);
    remaining.delete(k);
    if (isConnected(remaining)) out.add(k);
  }
  return out;
}

export function validPlacements(discs, excluded = null) {
  const candidates = new Set();
  for (const k of discs) {
    for (const n of hexNeighbors(parseKey(k))) {
      const nk = key(n);
      if (!discs.has(nk)) candidates.add(nk);
    }
  }
  if (excluded) candidates.delete(key(excluded));
  const out = new Set();
  for (const k of candidates) {
    const count = hexNeighbors(parseKey(k))
      .filter(n => discs.has(key(n))).length;
    if (count >= 2) out.add(k);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Reload `test_engine.html`. Expected: all 9 board-predicate tests pass.

- [ ] **Step 5: Commit**

```bash
git add play/src/engine.js tests/play/test_engine.js
git commit -m "feat(play): port board predicates to JS engine"
```

---

## Task 3: Engine — game state, applyMove, checkWin

Port `engine/game.py`.

**Files:**
- Modify: `play/src/engine.js`
- Modify: `tests/play/test_engine.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/play/test_engine.js`:

```js
import {
  initialState, applyMove, checkWin,
} from "../../play/src/engine.js";

test("initialState: 19 discs, 3 red, 3 black, all corners covered", () => {
  const s = initialState();
  assertEqual(s.discs.size, 19);
  assertEqual(s.redPawns.length, 3);
  assertEqual(s.blackPawns.length, 3);
  const allPawns = new Set([...s.redPawns, ...s.blackPawns].map(key));
  assertSetEqual(allPawns, INITIAL_CORNERS);
  assertEqual(s.currentPlayer, "red");
  assertEqual(s.lastPlacedDisc, null);
});

test("initialState: corners alternate red/black clockwise", () => {
  const order = [[2,0],[2,-2],[0,-2],[-2,0],[-2,2],[0,2]];
  const s = initialState();
  const red = new Set(s.redPawns.map(key));
  const black = new Set(s.blackPawns.map(key));
  const seq = order.map(p => red.has(key(p)) ? "R" : "B");
  assertEqual(seq, ["R", "B", "R", "B", "R", "B"]);
});

test("applyMove updates pawn, swaps player, records last_placed_disc", () => {
  const s = initialState();
  const move = {
    pawnIndex: 0,
    pawnFrom: [2, 0], pawnTo: [-1, 0],
    discFrom: [1, -2], discTo: [1, 1],
  };
  const ns = applyMove(s, move);
  assertEqual(ns.redPawns[0], [-1, 0]);
  assert(!ns.discs.has(key([1, -2])));
  assert(ns.discs.has(key([1, 1])));
  assertEqual(ns.discs.size, 19);
  assertEqual(ns.currentPlayer, "black");
  assertEqual(ns.lastPlacedDisc, [1, 1]);
});

test("checkWin: line, triangle, tick, spread", () => {
  const base = initialState();
  const mk = (red) => ({ ...base, redPawns: red, currentPlayer: "black" });
  // Line: (0,0)-(1,0)-(2,0)
  assertEqual(checkWin(mk([[0,0],[1,0],[2,0]])), "red");
  // Triangle
  assertEqual(checkWin(mk([[0,0],[1,0],[0,1]])), "red");
  // Tick
  assertEqual(checkWin(mk([[0,0],[1,0],[1,-1]])), "red");
  // Spread (no two adjacent)
  assertEqual(checkWin(mk([[0,0],[2,0],[-2,0]])), null);
});
```

- [ ] **Step 2: Run tests; verify they fail**

Reload. Expected: import errors for `initialState`, `applyMove`, `checkWin`.

- [ ] **Step 3: Implement game state**

Append to `play/src/engine.js`:

```js
const _CORNER_ORDER = [[2,0],[2,-2],[0,-2],[-2,0],[-2,2],[0,2]];

export function initialState(firstPlayer = "red") {
  return {
    discs: new Set(INITIAL_DISCS),
    redPawns:   [_CORNER_ORDER[0], _CORNER_ORDER[2], _CORNER_ORDER[4]],
    blackPawns: [_CORNER_ORDER[1], _CORNER_ORDER[3], _CORNER_ORDER[5]],
    currentPlayer: firstPlayer,
    lastPlacedDisc: null,
  };
}

export function applyMove(state, move) {
  const newDiscs = new Set(state.discs);
  newDiscs.delete(key(move.discFrom));
  newDiscs.add(key(move.discTo));

  let red = state.redPawns, black = state.blackPawns;
  if (state.currentPlayer === "red") {
    red = red.slice();
    red[move.pawnIndex] = move.pawnTo;
  } else {
    black = black.slice();
    black[move.pawnIndex] = move.pawnTo;
  }

  return {
    discs: newDiscs,
    redPawns: red,
    blackPawns: black,
    currentPlayer: state.currentPlayer === "red" ? "black" : "red",
    lastPlacedDisc: move.discTo,
  };
}

function _connected(pawns) {
  const [a, b, c] = pawns;
  const ab = isAdjacent(a, b), bc = isAdjacent(b, c), ac = isAdjacent(a, c);
  return (ab && bc) || (ab && ac) || (bc && ac);
}

export function checkWin(state) {
  if (_connected(state.redPawns)) return "red";
  if (_connected(state.blackPawns)) return "black";
  return null;
}
```

- [ ] **Step 4: Run tests; verify they pass**

Reload. Expected: all engine tests pass (board predicates + game state).

- [ ] **Step 5: Commit**

```bash
git add play/src/engine.js tests/play/test_engine.js
git commit -m "feat(play): port game state, applyMove, checkWin"
```

---

## Task 4: Engine — pawn slides and legal moves

Port `engine/moves.py`. The slide rule produces only the terminal disc in each direction (matching the Python fix from commit `64a89b8`).

**Files:**
- Modify: `play/src/engine.js`
- Modify: `tests/play/test_engine.js`

- [ ] **Step 1: Write failing tests**

Append to `tests/play/test_engine.js`:

```js
import { pawnDestinations, legalMoves } from "../../play/src/engine.js";

test("pawnDestinations: terminal disc only (slide rule)", () => {
  const s = initialState();
  // From (2,0): three open directions, each blocked by a black pawn or edge.
  // Direction (0,-1) -> blocked by black at (2,-2), terminal (2,-1)
  // Direction (-1,0) -> blocked by black at (-2,0), terminal (-1,0)
  // Direction (-1,1) -> blocked by black at (0,2),  terminal (1,1)
  // Other 3 directions step off the board immediately.
  const dests = new Set(pawnDestinations(s, [2, 0]).map(key));
  assertSetEqual(dests, ["2,-1", "-1,0", "1,1"]);
});

test("pawnDestinations: every destination is on a disc and unoccupied", () => {
  const s = initialState();
  const all = new Set([...s.redPawns, ...s.blackPawns].map(key));
  for (const pawn of s.redPawns) {
    for (const dest of pawnDestinations(s, pawn)) {
      assert(s.discs.has(key(dest)));
      assert(!all.has(key(dest)));
    }
  }
});

test("legalMoves count from initial state matches Python (570)", () => {
  // Cross-language parity guard: the Python engine returns 570.
  assertEqual(legalMoves(initialState()).length, 570);
});

test("legalMoves: pawn_from belongs to current player", () => {
  const s = initialState();
  const ownKeys = new Set(s.redPawns.map(key));
  for (const m of legalMoves(s)) {
    assert(ownKeys.has(key(m.pawnFrom)));
  }
});

test("legalMoves: disc_to touches >=2 discs after removal", () => {
  const s = initialState();
  for (const m of legalMoves(s)) {
    const after = new Set(s.discs);
    after.delete(key(m.discFrom));
    const count = hexNeighbors(m.discTo).filter(n => after.has(key(n))).length;
    assert(count >= 2);
  }
});
```

- [ ] **Step 2: Run tests; verify they fail**

Reload. Expected: imports fail.

- [ ] **Step 3: Implement pawnDestinations and legalMoves**

Append to `play/src/engine.js`:

```js
export function pawnDestinations(state, pawnPos) {
  const allPawns = new Set([
    ...state.redPawns.map(key),
    ...state.blackPawns.map(key),
  ]);
  const dests = [];
  for (const [dq, dr] of HEX_DIRECTIONS) {
    let q = pawnPos[0], r = pawnPos[1];
    let last = null;
    while (true) {
      q += dq; r += dr;
      const k = `${q},${r}`;
      if (!state.discs.has(k) || allPawns.has(k)) break;
      last = [q, r];
    }
    if (last) dests.push(last);
  }
  return dests;
}

function _discMovesAfterPawn(discs, occupied, lastPlacedDisc) {
  let removable = removableDiscs(discs, occupied);
  if (lastPlacedDisc) {
    const lk = key(lastPlacedDisc);
    const filtered = new Set(removable);
    filtered.delete(lk);
    removable = filtered;
  }
  const result = [];
  for (const fromKey of removable) {
    const remaining = new Set(discs);
    remaining.delete(fromKey);
    const from = parseKey(fromKey);
    for (const toKey of validPlacements(remaining, from)) {
      result.push([from, parseKey(toKey)]);
    }
  }
  return result;
}

export function legalMoves(state) {
  const pawns = state.currentPlayer === "red" ? state.redPawns : state.blackPawns;
  const allPawns = new Set([
    ...state.redPawns.map(key),
    ...state.blackPawns.map(key),
  ]);
  const moves = [];
  for (let i = 0; i < pawns.length; i++) {
    const from = pawns[i];
    for (const to of pawnDestinations(state, from)) {
      const newOccupied = new Set(allPawns);
      newOccupied.delete(key(from));
      newOccupied.add(key(to));
      for (const [discFrom, discTo] of _discMovesAfterPawn(
        state.discs, newOccupied, state.lastPlacedDisc,
      )) {
        moves.push({
          pawnIndex: i,
          pawnFrom: from,
          pawnTo: to,
          discFrom,
          discTo,
        });
      }
    }
  }
  return moves;
}
```

- [ ] **Step 4: Run tests; verify they pass**

Reload. Expected: parity test reports 570 legal moves; all tests pass.

- [ ] **Step 5: Sanity check parity against Python**

```bash
.venv/bin/python -c "from engine.game import initial_state; from engine.moves import legal_moves; print(len(legal_moves(initial_state())))"
```

Expected: `570`. Same number as the JS test.

- [ ] **Step 6: Commit**

```bash
git add play/src/engine.js tests/play/test_engine.js
git commit -m "feat(play): port pawn slide rule and legal-move generator"
```

---

## Task 5: Strategies port

Port `strategies/engine.py` to JS, including the heuristic scorer and config loader.

**Files:**
- Create: `play/src/strategies.js`
- Modify: `tests/play/test_strategies.js`

- [ ] **Step 1: Write failing tests**

Replace `tests/play/test_strategies.js`:

```js
import { test, assert, assertEqual } from "./test_runner.js";
import { initialState, legalMoves, applyMove, checkWin } from "../../play/src/engine.js";
import { loadStrategy, scoreMove, pickMove } from "../../play/src/strategies.js";

// Deterministic RNG for reproducibility.
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}

test("loadStrategy fetches a real config and returns its heuristics", async () => {
  const cfg = await loadStrategy("random");
  assert(cfg.name);
  assert(cfg.heuristics);
  assert(typeof cfg.heuristics.randomness === "number");
});

test("scoreMove returns a finite number", async () => {
  const cfg = await loadStrategy("pure-center");
  const s = initialState();
  const m = legalMoves(s)[0];
  const score = scoreMove(s, m, cfg.heuristics);
  assert(Number.isFinite(score));
});

test("pickMove returns a legal move", async () => {
  const cfg = await loadStrategy("aggressive");
  const s = initialState();
  const m = pickMove(s, cfg, seeded(42));
  const legalKeys = new Set(legalMoves(s).map(JSON.stringify));
  assert(legalKeys.has(JSON.stringify(m)));
});

test("seeded random vs random plays terminates with a valid winner", async () => {
  const cfg = await loadStrategy("random");
  const rng = seeded(7);
  let s = initialState();
  for (let i = 0; i < 400; i++) {
    const w = checkWin(s);
    if (w) { assert(["red","black"].includes(w)); return; }
    const moves = legalMoves(s);
    if (moves.length === 0) return; // draw
    s = applyMove(s, pickMove(s, cfg, rng));
  }
  assert(false, "game did not terminate within 400 turns");
});
```

- [ ] **Step 2: Run tests; verify they fail**

Reload. Expected: imports fail because `play/src/strategies.js` doesn't exist.

- [ ] **Step 3: Implement strategies.js**

This is a *literal* port of `strategies/engine.py:score_move`. Each heuristic term must match Python exactly, otherwise the seven tuned configs behave differently in the browser than they do in the tournament.

`play/src/strategies.js`:

```js
import {
  hexDistance, hexNeighbors, key, legalMoves,
} from "./engine.js";

const MAX_DIST = 4.0;

export async function loadStrategy(name) {
  // Resolve relative to this module's URL so the path works whether the
  // page is served from /play/, the test harness in /tests/play/, or
  // GitHub Pages at /<repo>/play/.
  const url = new URL(`../../strategies/configs/${name}.json`, import.meta.url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`load ${name}: ${res.status}`);
  return await res.json();
}

function avgPairDist(pawns) {
  const [a, b, c] = pawns;
  return (hexDistance(a, b) + hexDistance(b, c) + hexDistance(a, c)) / 3.0;
}

function discNeighborFraction(pawns, discs) {
  let total = 0, hits = 0;
  for (const p of pawns) {
    for (const n of hexNeighbors(p)) {
      total++;
      if (discs.has(key(n))) hits++;
    }
  }
  return total ? hits / total : 0.0;
}

export function scoreMove(state, move, h, rng = Math.random) {
  const isRed = state.currentPlayer === "red";
  const own = (isRed ? state.redPawns : state.blackPawns).slice();
  const opp = isRed ? state.blackPawns : state.redPawns;
  own[move.pawnIndex] = move.pawnTo;

  const newDiscs = new Set(state.discs);
  newDiscs.delete(key(move.discFrom));
  newDiscs.add(key(move.discTo));

  let s = 0.0;
  if (h.cluster_own)    s += h.cluster_own    * (1.0 - avgPairDist(own) / MAX_DIST);
  if (h.block_opponent) s += h.block_opponent * (avgPairDist(opp) / MAX_DIST);
  if (h.prefer_center)  s += h.prefer_center  * (1.0 - hexDistance(move.pawnTo, [0, 0]) / MAX_DIST);
  if (h.disc_help_self) s += h.disc_help_self * discNeighborFraction(own, newDiscs);
  if (h.disc_hurt_opp)  s += h.disc_hurt_opp  * (1.0 - discNeighborFraction(opp, newDiscs));
  if (h.randomness)     s += h.randomness     * rng();
  return s;
}

export function pickMove(state, config, rng = Math.random) {
  const moves = legalMoves(state);
  if (moves.length === 0) return null;
  let best = -Infinity, choice = null;
  for (const m of moves) {
    const score = scoreMove(state, m, config.heuristics, rng);
    if (score > best) { best = score; choice = m; }
  }
  return choice;
}
```

Notes on the port:
- `block_opponent` does not depend on `move` — it adds the same constant for every legal move and so doesn't affect arg-max selection. We include the term anyway to match Python literally and keep the door open for future scorer changes that might use it differently.
- Randomness is added inside `scoreMove` (matching Python), not as a separate tie-breaker after arg-max.
- `pickMove` takes the first max it sees, matching Python's `max(moves, key=...)`. With `randomness > 0` true ties are essentially impossible, so this is fine.

- [ ] **Step 4: Run tests; verify they pass**

```
python3 -m http.server 8000
```

Reload `http://localhost:8000/tests/play/test_engine.html`. Expected: all four strategy tests pass. (The `import.meta.url`-based path lets `loadStrategy` resolve `strategies/configs/random.json` correctly from the test harness location.)

- [ ] **Step 5: Commit**

```bash
git add play/src/strategies.js tests/play/test_strategies.js
git commit -m "feat(play): port strategy scorer and config loader"
```

---

## Task 6: Game tree (branching scrubber data structure)

The tree that backs the rich undo / play-from-here behaviour.

**Files:**
- Create: `play/src/game-tree.js`
- Modify: `tests/play/test_game_tree.js`

- [ ] **Step 1: Write failing tests**

Replace `tests/play/test_game_tree.js`:

```js
import { test, assert, assertEqual } from "./test_runner.js";
import { initialState, applyMove } from "../../play/src/engine.js";
import { GameTree } from "../../play/src/game-tree.js";

const fakeMove = (suffix) => ({
  pawnIndex: 0, pawnFrom: [2,0], pawnTo: [-1,0],
  discFrom: [1,-2], discTo: [1, 1 + suffix],
});

test("GameTree starts at root with initial state", () => {
  const t = new GameTree(initialState());
  assertEqual(t.current, t.root);
  assertEqual(t.current.parent, null);
  assertEqual(t.current.children.length, 0);
  assertEqual(t.current.move, null);
});

test("playMove advances current and links parent/child", () => {
  const t = new GameTree(initialState());
  t.playMove(fakeMove(0), applyMove);
  assertEqual(t.current.parent, t.root);
  assertEqual(t.root.children.length, 1);
  assertEqual(t.root.mainline, t.current);
});

test("first/prev/next/last walk along the mainline", () => {
  const t = new GameTree(initialState());
  t.playMove(fakeMove(0), applyMove);
  t.playMove(fakeMove(1), applyMove);
  const leaf = t.current;
  t.first(); assertEqual(t.current, t.root);
  t.next();  assertEqual(t.current, t.root.mainline);
  t.last();  assertEqual(t.current, leaf);
  t.prev();  assertEqual(t.current, t.root.mainline);
});

test("playMove from non-leaf creates a branch and updates mainline", () => {
  const t = new GameTree(initialState());
  t.playMove(fakeMove(0), applyMove);  // child A
  const childA = t.current;
  t.first();                            // back to root
  t.playMove(fakeMove(1), applyMove);  // child B (new branch)
  const childB = t.current;
  assertEqual(t.root.children.length, 2);
  assertEqual(t.root.mainline, childB);
  // Old branch still reachable
  assert(t.root.children.includes(childA));
});

test("mainline log walks from root to deepest descendant via .mainline", () => {
  const t = new GameTree(initialState());
  t.playMove(fakeMove(0), applyMove);
  t.playMove(fakeMove(1), applyMove);
  t.first();
  const log = t.mainlineFromRoot();
  assertEqual(log.length, 3); // root + 2 moves
  assertEqual(log[0], t.root);
});
```

- [ ] **Step 2: Run tests; verify they fail**

Reload. Expected: import errors.

- [ ] **Step 3: Implement game-tree.js**

`play/src/game-tree.js`:

```js
export class GameTree {
  constructor(initial) {
    this.root = {
      state: initial, move: null, parent: null,
      children: [], mainline: null,
    };
    this.current = this.root;
  }

  playMove(move, applyFn) {
    const next = {
      state: applyFn(this.current.state, move),
      move,
      parent: this.current,
      children: [],
      mainline: null,
    };
    this.current.children.push(next);
    this.current.mainline = next;
    this.current = next;
    return next;
  }

  first() { this.current = this.root; }
  prev()  { if (this.current.parent) this.current = this.current.parent; }
  next()  { if (this.current.mainline) this.current = this.current.mainline; }
  last()  { while (this.current.mainline) this.current = this.current.mainline; }

  mainlineFromRoot() {
    const out = [this.root];
    let n = this.root;
    while (n.mainline) { n = n.mainline; out.push(n); }
    return out;
  }
}
```

- [ ] **Step 4: Run tests; verify they pass**

Reload. Expected: all 5 game-tree tests pass.

- [ ] **Step 5: Commit**

```bash
git add play/src/game-tree.js tests/play/test_game_tree.js
git commit -m "feat(play): branching game tree for rich undo"
```

---

## Task 7: Page shell, board renderer, "New game" loop

A working page that renders the initial position, plays a strategy-vs-strategy demo (no human input yet), and lets you start over. We get the rendering pipeline alive end-to-end before adding interaction.

**Files:**
- Create: `play/index.html`
- Create: `play/play.css`
- Create: `play/src/ui.js`

- [ ] **Step 1: Write the page shell**

`play/index.html`:

```html
<!doctype html>
<meta charset="utf-8">
<title>Nonaga — Play</title>
<link rel="stylesheet" href="play.css">
<header>
  <h1>Nonaga — Play</h1>
  <div class="controls">
    <label>Strategy
      <select id="strategy">
        <option>aggressive</option>
        <option>defensive</option>
        <option>disc-sculptor</option>
        <option>disruptor</option>
        <option selected>pure-center</option>
        <option>random</option>
        <option>speedrunner</option>
      </select>
    </label>
    <label>Color
      <select id="color">
        <option value="red" selected>Red (you go first)</option>
        <option value="black">Black (AI goes first)</option>
        <option value="random">Random</option>
      </select>
    </label>
    <button id="new-game">New game</button>
  </div>
</header>
<main>
  <section id="board-area">
    <div id="board"></div>
    <div class="scrubber">
      <button id="btn-first">⏮</button>
      <button id="btn-prev">⏪</button>
      <button id="btn-next">⏩</button>
      <button id="btn-last">⏭</button>
    </div>
    <p id="status">Click "New game" to start.</p>
  </section>
  <aside id="log-area">
    <h2>Move log</h2>
    <div id="move-log"></div>
    <label class="hint"><input type="checkbox" id="hint"> Hint: preview slide destinations on hover</label>
  </aside>
</main>
<script type="module" src="src/ui.js"></script>
```

- [ ] **Step 2: Write the styles**

`play/play.css`:

```css
* { box-sizing: border-box; }
body { font: 14px/1.4 system-ui, sans-serif; margin: 0; padding: 1rem; background: #fafaf7; }
header h1 { margin: 0 0 .5rem; }
.controls { display: flex; gap: .75rem; align-items: center; flex-wrap: wrap; }
main { display: grid; grid-template-columns: minmax(360px, 420px) 1fr; gap: 1.5rem; margin-top: 1rem; }
#board { width: 360px; height: 340px; }
.scrubber { display: flex; gap: .25rem; margin-top: .5rem; }
.scrubber button { padding: .25rem .5rem; }
#status { min-height: 1.4em; margin: .75rem 0; font-weight: 500; }
#log-area { border-left: 1px solid #ddd; padding-left: 1rem; }
#move-log { font: 12px/1.5 ui-monospace, monospace; max-height: 60vh; overflow-y: auto; border: 1px solid #eee; padding: .5rem; background: #fff; }
#move-log .active { background: #ffe; }
.hint { display: block; margin-top: .75rem; font-size: 12px; color: #555; }
.banner { padding: .5rem; background: #efe; border: 1px solid #cfc; }
.banner.lose { background: #fee; border-color: #fcc; }
/* SVG */
.disc { fill: #e8dfd0; stroke: #b0a090; stroke-width: 1.5; }
.disc.last-placed { stroke: #888; stroke-dasharray: 3 2; }
.disc.removable { cursor: pointer; stroke: #4a7; stroke-width: 2.5; }
.disc.placement { cursor: pointer; fill: #d4f0d4; }
.pawn-red { fill: #c0392b; stroke: #922b21; stroke-width: 2; }
.pawn-black { fill: #2c2c2c; stroke: #000; stroke-width: 2; }
.pawn.selectable { cursor: pointer; }
.pawn.selected { stroke-width: 4; stroke: #f1c40f; }
.pawn.ghost { opacity: .5; stroke-dasharray: 3 2; }
.dest { cursor: pointer; fill: #ffd; stroke: #aa8; stroke-dasharray: 2 2; }
```

- [ ] **Step 3: Wire ui.js (renderer + new-game loop, no human input yet)**

`play/src/ui.js`:

```js
import { initialState, applyMove, checkWin, legalMoves } from "./engine.js";
import { loadStrategy, pickMove } from "./strategies.js";
import { GameTree } from "./game-tree.js";

const SIZE = 22, W = 360, H = 340;
const SVG_NS = "http://www.w3.org/2000/svg";

function axialToPixel(q, r) {
  return [W/2 + SIZE * 1.5 * q,
          H/2 + SIZE * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r)];
}

let tree = null;
let strategyConfig = null;
let humanColor = "red";

async function newGame() {
  strategyConfig = await loadStrategy(document.getElementById("strategy").value);
  const colorChoice = document.getElementById("color").value;
  humanColor = colorChoice === "random" ? (Math.random() < 0.5 ? "red" : "black") : colorChoice;
  tree = new GameTree(initialState("red"));
  render();
  await maybeAITurn();
}

function render() {
  const s = tree.current.state;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  for (const k of s.discs) {
    const [q, r] = k.split(",").map(Number);
    const [px, py] = axialToPixel(q, r);
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", px); c.setAttribute("cy", py);
    c.setAttribute("r", SIZE - 2);
    c.classList.add("disc");
    if (s.lastPlacedDisc && k === `${s.lastPlacedDisc[0]},${s.lastPlacedDisc[1]}`) {
      c.classList.add("last-placed");
    }
    svg.appendChild(c);
  }

  for (const [color, list] of [["red", s.redPawns], ["black", s.blackPawns]]) {
    for (const [q, r] of list) {
      const [px, py] = axialToPixel(q, r);
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", px); c.setAttribute("cy", py);
      c.setAttribute("r", SIZE * 0.44);
      c.classList.add("pawn", `pawn-${color}`);
      svg.appendChild(c);
    }
  }
  document.getElementById("board").replaceChildren(svg);

  const w = checkWin(s);
  const status = document.getElementById("status");
  if (w) {
    status.textContent = w === humanColor ? "You won!" : `${strategyConfig.name} won.`;
  } else if (s.currentPlayer === humanColor) {
    status.textContent = "Your turn — pick a pawn.";
  } else {
    status.textContent = "AI thinking…";
  }

  renderLog();
}

function renderLog() {
  const nodes = tree.mainlineFromRoot();
  const log = document.getElementById("move-log");
  log.innerHTML = nodes.slice(1).map((n, i) => {
    const m = n.move;
    const cls = n === tree.current ? "active" : "";
    return `<div class="${cls}">T${i+1} ${n.parent.state.currentPlayer}: ` +
           `pawn[${m.pawnIndex}] [${m.pawnFrom}]→[${m.pawnTo}] | ` +
           `disc [${m.discFrom}]→[${m.discTo}]</div>`;
  }).join("");
}

async function maybeAITurn() {
  while (tree.current.state.currentPlayer !== humanColor && !checkWin(tree.current.state)) {
    if (legalMoves(tree.current.state).length === 0) break;
    await new Promise(r => setTimeout(r, 200));
    const m = pickMove(tree.current.state, strategyConfig);
    tree.playMove(m, applyMove);
    render();
  }
}

// Scrubber wiring
document.getElementById("btn-first").onclick = () => { tree?.first(); render(); };
document.getElementById("btn-prev").onclick  = () => { tree?.prev();  render(); };
document.getElementById("btn-next").onclick  = () => { tree?.next();  render(); };
document.getElementById("btn-last").onclick  = () => { tree?.last();  render(); };

document.getElementById("new-game").onclick = newGame;
```

- [ ] **Step 4: Smoke-test in the browser**

```
python3 -m http.server 8000
```

Open `http://localhost:8000/play/`. Click "New game" with **Color = Black** so the AI plays both halves of the demo. Expected: board renders, status alternates red/black, move log fills, scrubber walks through the game.

(With "Red" selected, the page will hang on "Your turn" — that's fine, human input lands in Task 8.)

- [ ] **Step 5: Commit**

```bash
git add play/index.html play/play.css play/src/ui.js
git commit -m "feat(play): page shell, board renderer, AI-only demo loop"
```

---

## Task 8: Human input — interaction state machine

Implement the stage-then-confirm click flow. After this task the page is fully playable.

**Files:**
- Modify: `play/src/ui.js`

- [ ] **Step 1: Add the staging state**

Replace the existing engine import in `play/src/ui.js` with:

```js
import {
  initialState, applyMove, checkWin, legalMoves,
  key, pawnDestinations, removableDiscs, validPlacements,
} from "./engine.js";
```

Then add below the imports:

```js
let staging = null; // { phase, pawnIndex, pawnFrom?, pawnTo?, discFrom?, discTo? }

function resetStaging() { staging = null; }
```

- [ ] **Step 2: Extend render() to handle staging highlights and click handlers**

Replace the `render()` function in `play/src/ui.js` with:

```js
function render() {
  const s = tree.current.state;
  const isHumanTurn = s.currentPlayer === humanColor && !checkWin(s);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  // Compute staging artefacts
  const stagedDiscFromKey = staging?.discFrom ? key(staging.discFrom) : null;
  const stagedDiscToKey   = staging?.discTo   ? key(staging.discTo)   : null;

  // Discs
  for (const k of s.discs) {
    if (k === stagedDiscFromKey) continue; // hide removed disc
    const [q, r] = k.split(",").map(Number);
    drawDisc(svg, q, r, k, s);
  }
  // Ghost placement
  if (stagedDiscToKey) {
    const [q, r] = staging.discTo;
    const c = drawDisc(svg, q, r, stagedDiscToKey, s);
    c.classList.add("placement");
  }

  // Pawn slide-destination highlights
  if (staging?.phase === "pawn-selected") {
    const dests = pawnDestinations(s, staging.pawnFrom);
    for (const [q, r] of dests) {
      const [px, py] = axialToPixel(q, r);
      const d = document.createElementNS(SVG_NS, "circle");
      d.setAttribute("cx", px); d.setAttribute("cy", py); d.setAttribute("r", SIZE - 4);
      d.classList.add("dest");
      d.onclick = () => { stagePawnTo([q, r]); };
      svg.appendChild(d);
    }
  }

  // Removable-disc highlights
  if (staging?.phase === "pawn-staged") {
    const occupied = occupiedAfterPawnStage(s);
    const rem = removableDiscs(s.discs, occupied);
    rem.delete(s.lastPlacedDisc ? key(s.lastPlacedDisc) : "");
    for (const k of rem) {
      const c = svg.querySelector(`[data-key="${k}"]`);
      if (c) {
        c.classList.add("removable");
        c.onclick = () => { stageDiscFrom(k.split(",").map(Number)); };
      }
    }
  }

  // Placement highlights
  if (staging?.phase === "disc-staged") {
    const after = new Set(s.discs); after.delete(key(staging.discFrom));
    const places = validPlacements(after, staging.discFrom);
    for (const k of places) {
      const [q, r] = k.split(",").map(Number);
      const [px, py] = axialToPixel(q, r);
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", px); c.setAttribute("cy", py); c.setAttribute("r", SIZE - 4);
      c.classList.add("disc", "placement");
      c.onclick = () => { stageDiscTo([q, r]); };
      svg.appendChild(c);
    }
  }

  // Pawns (skip the moving pawn if its post-stage position differs)
  drawPawns(svg, s, staging);

  document.getElementById("board").replaceChildren(svg);

  // Confirm/cancel buttons
  const confirmRow = ensureConfirmRow();
  confirmRow.style.display = staging?.phase === "confirm" ? "flex" : "none";

  // Status & log
  setStatus(s, isHumanTurn);
  renderLog();
}

function drawDisc(svg, q, r, k, state) {
  const [px, py] = axialToPixel(q, r);
  const c = document.createElementNS(SVG_NS, "circle");
  c.setAttribute("cx", px); c.setAttribute("cy", py);
  c.setAttribute("r", SIZE - 2);
  c.classList.add("disc");
  c.dataset.key = k;
  if (state.lastPlacedDisc && k === key(state.lastPlacedDisc)) c.classList.add("last-placed");
  svg.appendChild(c);
  return c;
}

function drawPawns(svg, state, staging) {
  for (const [color, list] of [["red", state.redPawns], ["black", state.blackPawns]]) {
    list.forEach((pos, idx) => {
      const isMover = staging && color === state.currentPlayer && idx === staging.pawnIndex;
      const drawAt = isMover && staging.pawnTo ? staging.pawnTo : pos;
      const [px, py] = axialToPixel(drawAt[0], drawAt[1]);
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", px); c.setAttribute("cy", py);
      c.setAttribute("r", SIZE * 0.44);
      c.classList.add("pawn", `pawn-${color}`);
      if (isMover && staging.pawnTo) c.classList.add("ghost");
      if (color === humanColor && state.currentPlayer === humanColor && !checkWin(state)) {
        c.classList.add("selectable");
        c.onclick = () => selectPawn(idx, pos);
        if (staging?.phase === "pawn-selected" && staging.pawnIndex === idx) c.classList.add("selected");
      }
      svg.appendChild(c);
    });
  }
}

function occupiedAfterPawnStage(state) {
  const all = new Set([...state.redPawns.map(key), ...state.blackPawns.map(key)]);
  all.delete(key(staging.pawnFrom));
  all.add(key(staging.pawnTo));
  return all;
}

function selectPawn(idx, pos) {
  staging = { phase: "pawn-selected", pawnIndex: idx, pawnFrom: pos };
  render();
}
function stagePawnTo(to) {
  staging = { ...staging, phase: "pawn-staged", pawnTo: to };
  render();
}
function stageDiscFrom(from) {
  staging = { ...staging, phase: "disc-staged", discFrom: from };
  render();
}
function stageDiscTo(to) {
  staging = { ...staging, phase: "confirm", discTo: to };
  render();
}

function ensureConfirmRow() {
  let row = document.getElementById("confirm-row");
  if (!row) {
    row = document.createElement("div");
    row.id = "confirm-row";
    row.style.cssText = "display:none;gap:.5rem;margin-top:.5rem;";
    row.innerHTML = `<button id="btn-confirm">Confirm turn</button>
                     <button id="btn-cancel">Cancel</button>`;
    document.querySelector(".scrubber").after(row);
    document.getElementById("btn-confirm").onclick = confirmTurn;
    document.getElementById("btn-cancel").onclick = () => { resetStaging(); render(); };
  }
  return row;
}

async function confirmTurn() {
  const move = {
    pawnIndex: staging.pawnIndex,
    pawnFrom: staging.pawnFrom, pawnTo: staging.pawnTo,
    discFrom: staging.discFrom, discTo: staging.discTo,
  };
  resetStaging();
  tree.playMove(move, applyMove);
  render();
  await maybeAITurn();
}

function setStatus(s, isHumanTurn) {
  const status = document.getElementById("status");
  const w = checkWin(s);
  if (w) {
    status.innerHTML = `<span class="banner ${w === humanColor ? "" : "lose"}">${
      w === humanColor ? "You won!" : strategyConfig.name + " won."
    }</span>`;
    return;
  }
  if (!isHumanTurn) { status.textContent = "AI thinking…"; return; }
  status.textContent = ({
    "pawn-selected": "Choose a destination for your pawn.",
    "pawn-staged":   "Pick a free edge disc to remove.",
    "disc-staged":   "Pick where to place the disc.",
    "confirm":       "Confirm or cancel your turn.",
  }[staging?.phase] ?? "Your turn — pick a pawn.");
}
```

- [ ] **Step 3: Reset staging when scrubbing**

Update the scrubber wiring at the bottom of `play/src/ui.js`:

```js
const wrap = (fn) => () => { resetStaging(); fn(); render(); };
document.getElementById("btn-first").onclick = wrap(() => tree?.first());
document.getElementById("btn-prev").onclick  = wrap(() => tree?.prev());
document.getElementById("btn-next").onclick  = wrap(() => tree?.next());
document.getElementById("btn-last").onclick  = wrap(() => tree?.last());
```

- [ ] **Step 4: Manual smoke**

Reload the page. With "Red" selected, click "New game". Walk through:

1. Click one of your red pawns → its slide destinations highlight.
2. Click a destination → ghost pawn appears, removable discs highlight.
3. Click a removable disc → it disappears, valid placements highlight.
4. Click a placement → ghost disc appears, "Confirm turn / Cancel" buttons show.
5. Click "Confirm" → AI plays after a short delay, status updates.
6. Use scrubber → it walks through the recorded turns.
7. Scrub back, click a different pawn → branch is created (mainline is the new branch).

- [ ] **Step 5: Commit**

```bash
git add play/src/ui.js
git commit -m "feat(play): stage-then-confirm human-input state machine"
```

---

## Task 9: Hint mode and color-default flip

Two small UX rules from the spec.

**Files:**
- Modify: `play/src/ui.js`

- [ ] **Step 1: Hint hover preview**

Add inside `drawPawns`, where `selectable` is added:

```js
if (color === humanColor && state.currentPlayer === humanColor && !checkWin(state)) {
  c.classList.add("selectable");
  c.onclick = () => selectPawn(idx, pos);
  if (staging?.phase === "pawn-selected" && staging.pawnIndex === idx) c.classList.add("selected");

  if (document.getElementById("hint").checked && !staging) {
    c.onmouseenter = () => previewDestinations(pos);
    c.onmouseleave = () => clearPreview();
  }
}
```

Add helpers:

```js
function previewDestinations(pos) {
  const svg = document.querySelector("#board svg");
  if (!svg) return;
  for (const [q, r] of pawnDestinations(tree.current.state, pos)) {
    const [px, py] = axialToPixel(q, r);
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", px); c.setAttribute("cy", py); c.setAttribute("r", SIZE - 6);
    c.classList.add("preview");
    c.setAttribute("fill", "transparent");
    c.setAttribute("stroke", "#aaa");
    c.setAttribute("stroke-dasharray", "2 2");
    c.setAttribute("pointer-events", "none");
    svg.appendChild(c);
  }
}
function clearPreview() {
  document.querySelectorAll(".preview").forEach(el => el.remove());
}
```

- [ ] **Step 2: Flip color default after each game**

Modify `newGame()`:

```js
async function newGame() {
  strategyConfig = await loadStrategy(document.getElementById("strategy").value);
  const sel = document.getElementById("color");
  let colorChoice = sel.value;
  // If a previous game just finished and the user didn't change the picker,
  // flip the default for the next game.
  if (window._prevHumanColor && colorChoice !== "random" && colorChoice === window._prevHumanColor) {
    colorChoice = colorChoice === "red" ? "black" : "red";
    sel.value = colorChoice;
  }
  humanColor = colorChoice === "random" ? (Math.random() < 0.5 ? "red" : "black") : colorChoice;
  window._prevHumanColor = humanColor;
  tree = new GameTree(initialState("red"));
  resetStaging();
  render();
  await maybeAITurn();
}
```

- [ ] **Step 3: Manual smoke**

Reload, toggle Hint on, hover your pawns → faint dashed circles preview destinations.
Play a full game, click "New game" twice with the picker untouched → color flips between Red and Black each time.

- [ ] **Step 4: Commit**

```bash
git add play/src/ui.js
git commit -m "feat(play): hint hover preview and alternating color default"
```

---

## Task 10: Flask `/play` route + README

Local-dev parity and discoverability. No new behaviour — `/play/` is just the same static files.

**Files:**
- Modify: `dashboard/app.py`
- Modify: `README.md`

- [ ] **Step 1: Add the route**

In `dashboard/app.py`, near the other `@app.route` definitions, add:

```python
from flask import send_from_directory
import os

PLAY_DIR = os.path.join(os.path.dirname(__file__), "..", "play")

@app.route("/play/")
@app.route("/play/<path:filename>")
def play_static(filename="index.html"):
    return send_from_directory(PLAY_DIR, filename)
```

- [ ] **Step 2: Verify locally**

```bash
python3 run.py --serve
```

Open `http://localhost:5000/play/`. Expected: same play page that `python3 -m http.server` serves at `/play/`.

- [ ] **Step 3: Update README**

Add a section after the "Start the dashboard" section in `README.md`:

```markdown
## Play in the browser

A static play page is available at `play/index.html`. To play locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/play/
```

Or via the Flask dashboard at `http://localhost:5000/play/`.

The page is fully static — drop the repo onto GitHub Pages and `play/index.html` works as-is.
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/app.py README.md
git commit -m "feat(play): /play route in Flask app + README section"
```

---

## Task 11: Final verification pass

A short end-to-end check before declaring done.

- [ ] **Step 1: Run the full Python test suite (no regressions in engine)**

```bash
.venv/bin/pytest tests/ 2>&1 | tail -5
```

Expected: 76 passed.

- [ ] **Step 2: Run the JS test harness**

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/tests/play/test_engine.html`. Expected: every test passes; the parity test reports 570 legal moves from the initial state.

- [ ] **Step 3: Play three games end-to-end**

- One game vs `random` (should be easy to win).
- One game vs `pure-center` (test branching: scrub back two turns, take a different action, verify the AI plays again from the new branch).
- One game vs `speedrunner` with Color=Random.

For each: confirm the win banner shows, "New game" works, the move log scrolls, and the slide rule is respected (you can never stop at an intermediate disc).

- [ ] **Step 4: Spot-check on a fresh tab without the Flask server**

```bash
python3 -m http.server 8000 --directory .
```

Open `http://localhost:8000/play/`. Expected: works identically. This is the GitHub Pages parity check.

- [ ] **Step 5: Mark plan complete**

No commit needed unless issues surface during the verification pass.
