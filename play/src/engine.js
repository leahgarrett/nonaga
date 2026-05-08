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
