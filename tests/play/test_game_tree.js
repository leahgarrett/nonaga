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
