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
  if (excluded !== null) candidates.delete(key(excluded));
  const out = new Set();
  for (const k of candidates) {
    const count = hexNeighbors(parseKey(k))
      .filter(n => discs.has(key(n))).length;
    if (count >= 2) out.add(k);
  }
  return out;
}

const _CORNER_ORDER = [[2,0],[2,-2],[0,-2],[-2,0],[-2,2],[0,2]];

export function initialState(firstPlayer = "red") {
  return {
    discs: new Set(INITIAL_DISCS),
    redPawns:   [_CORNER_ORDER[0].slice(), _CORNER_ORDER[2].slice(), _CORNER_ORDER[4].slice()],
    blackPawns: [_CORNER_ORDER[1].slice(), _CORNER_ORDER[3].slice(), _CORNER_ORDER[5].slice()],
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
  if (lastPlacedDisc !== null) {
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
