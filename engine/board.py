from __future__ import annotations

HEX_DIRECTIONS: tuple[tuple[int, int], ...] = (
    (1, 0), (1, -1), (0, -1), (-1, 0), (-1, 1), (0, 1)
)

INITIAL_DISCS: frozenset[tuple[int, int]] = frozenset(
    (q, r)
    for q in range(-2, 3)
    for r in range(-2, 3)
    if max(abs(q), abs(r), abs(q + r)) <= 2
)

# Clockwise from right: ensures alternating red/black placement
INITIAL_CORNERS: frozenset[tuple[int, int]] = frozenset({
    (2, 0), (2, -2), (0, -2), (-2, 0), (-2, 2), (0, 2)
})


def hex_neighbors(pos: tuple[int, int]) -> list[tuple[int, int]]:
    q, r = pos
    return [(q + dq, r + dr) for dq, dr in HEX_DIRECTIONS]


def hex_distance(a: tuple[int, int], b: tuple[int, int]) -> int:
    dq, dr = b[0] - a[0], b[1] - a[1]
    return max(abs(dq), abs(dr), abs(dq + dr))


def is_adjacent(a: tuple[int, int], b: tuple[int, int]) -> bool:
    return hex_distance(a, b) == 1


def is_connected(discs: frozenset[tuple[int, int]]) -> bool:
    if not discs:
        return True
    start = next(iter(discs))
    visited: set[tuple[int, int]] = {start}
    queue = [start]
    while queue:
        pos = queue.pop()
        for n in hex_neighbors(pos):
            if n in discs and n not in visited:
                visited.add(n)
                queue.append(n)
    return len(visited) == len(discs)


def edge_discs(discs: frozenset[tuple[int, int]]) -> frozenset[tuple[int, int]]:
    return frozenset(
        pos for pos in discs
        if any(n not in discs for n in hex_neighbors(pos))
    )


def removable_discs(
    discs: frozenset[tuple[int, int]],
    occupied: frozenset[tuple[int, int]],
) -> frozenset[tuple[int, int]]:
    return frozenset(
        pos for pos in edge_discs(discs)
        if pos not in occupied and is_connected(discs - {pos})
    )


def valid_placements(
    discs: frozenset[tuple[int, int]],
    excluded: tuple[int, int] | None = None,
) -> frozenset[tuple[int, int]]:
    candidates: set[tuple[int, int]] = set()
    for pos in discs:
        for n in hex_neighbors(pos):
            if n not in discs:
                candidates.add(n)
    if excluded is not None:
        candidates.discard(excluded)
    return frozenset(
        pos for pos in candidates
        if sum(1 for n in hex_neighbors(pos) if n in discs) >= 2
    )
