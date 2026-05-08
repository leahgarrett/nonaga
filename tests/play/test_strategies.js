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
