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
