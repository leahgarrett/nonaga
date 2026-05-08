import {
  hexDistance, hexNeighbors, key, legalMoves,
} from "./engine.js";

const MAX_DIST = 4.0;

export async function loadStrategy(name) {
  const url = new URL(`../../strategies/configs/${name}.json`, import.meta.url);
  if (typeof window === "undefined" && url.protocol === "file:") {
    // Node fallback: native fetch can't read file:// URLs before Node 21.
    const { readFile } = await import("node:fs/promises");
    return JSON.parse(await readFile(url, "utf8"));
  }
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
