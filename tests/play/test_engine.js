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

test("isConnected: empty, single, adjacent pair, non-adjacent pair, full board", () => {
  assert(isConnected(new Set()));
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

test("validPlacements with default excluded=null does not throw", () => {
  const remaining = new Set(INITIAL_DISCS);
  remaining.delete("2,0");
  const placements = validPlacements(remaining);
  assert(placements instanceof Set);
});

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
  // discTo [1,1] is already in INITIAL_DISCS, so net size is 18 not 19
  assertEqual(ns.discs.size, 18);
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
