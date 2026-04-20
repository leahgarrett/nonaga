# Nonaga Strategy Lab — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-play harness for Nonaga where JSON-configured strategies compete in round-robin tournaments, results are stored as JSON, and a Flask dashboard shows win rates, head-to-head stats, and step-through game replays.

**Architecture:** Pure Python game engine using axial hex coordinates. Strategies score every legal move with weighted heuristics from a JSON config and pick the highest. Tournament runner plays every strategy pair 100 games (50/50 first-player split) plus a random baseline, writing timestamped JSON results. Flask serves three views: leaderboard, head-to-head matrix, and game replay with SVG board.

**Tech Stack:** Python 3.11+, Flask 3.x, pytest — no other dependencies.

---

## File Map

**Created:**
- `engine/__init__.py`
- `engine/board.py` — axial hex coordinates, adjacency, initial disc layout, connectivity, edge/removable disc logic, valid placement positions
- `engine/game.py` — `GameState` and `Move` dataclasses, `initial_state()`, `apply_move()`, `check_win()`, `play_game()`
- `engine/moves.py` — `pawn_destinations()`, `disc_moves_after_pawn()`, `legal_moves()`
- `strategies/__init__.py`
- `strategies/configs/random.json`
- `strategies/configs/aggressive.json`
- `strategies/configs/defensive.json`
- `strategies/engine.py` — `load_strategy()`, `score_move()`, `choose_move()`, `make_strategy_fn()`
- `runner/__init__.py`
- `runner/tournament.py` — `load_all_strategies()`, `run_matchup()`, `run_tournament()`
- `runner/recorder.py` — `save_results()`, `load_results()`, `load_latest_results()`
- `dashboard/__init__.py`
- `dashboard/app.py` — Flask app factory, routes for `/`, `/matrix`, `/matchup/<a>/<b>`, `/api/game/<a>/<b>/<id>`
- `dashboard/templates/base.html`
- `dashboard/templates/leaderboard.html`
- `dashboard/templates/matrix.html`
- `dashboard/templates/replay.html`
- `dashboard/static/style.css`
- `dashboard/static/board.js` — SVG hex board rendering, step-through replay
- `tests/engine/__init__.py`, `tests/engine/test_board.py`, `tests/engine/test_game.py`, `tests/engine/test_moves.py`
- `tests/strategies/__init__.py`, `tests/strategies/test_engine.py`
- `tests/runner/__init__.py`, `tests/runner/test_tournament.py`
- `run.py` — CLI entry point
- `requirements.txt`
- `results/.gitkeep`

---

## Task 1: Project scaffold

**Files:**
- Create: `requirements.txt`
- Create: all `__init__.py` files and empty directories

- [ ] **Step 1: Create requirements.txt**

```
flask==3.0.3
pytest==8.2.0
```

- [ ] **Step 2: Create directory structure**

```bash
mkdir -p engine strategies/configs runner dashboard/templates dashboard/static \
         tests/engine tests/strategies tests/runner results
touch engine/__init__.py strategies/__init__.py runner/__init__.py dashboard/__init__.py
touch tests/__init__.py tests/engine/__init__.py tests/strategies/__init__.py tests/runner/__init__.py
touch results/.gitkeep
```

- [ ] **Step 3: Install dependencies**

```bash
pip install -r requirements.txt
```

- [ ] **Step 4: Verify pytest runs**

```bash
pytest --collect-only
```

Expected: `no tests ran` or `0 items`, no errors.

- [ ] **Step 5: Commit**

```bash
git add requirements.txt engine/ strategies/ runner/ dashboard/ tests/ results/
git commit -m "chore: project scaffold"
```

---

## Task 2: Hex board — coordinates, adjacency, connectivity

**Files:**
- Create: `engine/board.py`
- Create: `tests/engine/test_board.py`

**Background:** The board uses axial hex coordinates `(q, r)`. The 6 movement directions are `(1,0), (1,-1), (0,-1), (-1,0), (-1,1), (0,1)`. Hex distance between two positions equals `max(|dq|, |dr|, |dq+dr|)`. Adjacent means distance == 1.

The initial 19 discs form a hexagon of radius 2: all `(q, r)` where `max(|q|, |r|, |q+r|) <= 2`. The 6 corners (pawn starting positions), going clockwise from right: `(2,0), (2,-2), (0,-2), (-2,0), (-2,2), (0,2)`.

An **edge disc** has at least one neighbor not in `discs`. A disc is **removable** if it has no pawn, is on the edge, and removing it keeps the remaining discs connected (BFS check). A **valid placement** position is outside `discs`, touches 2+ discs, and is not the disc's own original position.

- [ ] **Step 1: Write failing tests**

```python
# tests/engine/test_board.py
from engine.board import (
    HEX_DIRECTIONS, INITIAL_DISCS, INITIAL_CORNERS,
    hex_neighbors, hex_distance, is_adjacent,
    is_connected, edge_discs, removable_discs, valid_placements,
)

def test_hex_directions_count():
    assert len(HEX_DIRECTIONS) == 6

def test_initial_discs_count():
    assert len(INITIAL_DISCS) == 19

def test_initial_corners_count():
    assert len(INITIAL_CORNERS) == 6

def test_initial_corners_are_in_initial_discs():
    assert INITIAL_CORNERS.issubset(INITIAL_DISCS)

def test_hex_neighbors_count():
    assert len(hex_neighbors((0, 0))) == 6

def test_hex_neighbors_of_origin():
    assert set(hex_neighbors((0, 0))) == {(1,0),(1,-1),(0,-1),(-1,0),(-1,1),(0,1)}

def test_hex_distance_zero():
    assert hex_distance((0, 0), (0, 0)) == 0

def test_hex_distance_adjacent():
    assert hex_distance((0, 0), (1, 0)) == 1

def test_hex_distance_two_steps():
    assert hex_distance((0, 0), (2, 0)) == 2

def test_is_adjacent_true():
    assert is_adjacent((0, 0), (1, 0))

def test_is_adjacent_false():
    assert not is_adjacent((0, 0), (2, 0))

def test_is_connected_single():
    assert is_connected(frozenset({(0, 0)}))

def test_is_connected_two_adjacent():
    assert is_connected(frozenset({(0, 0), (1, 0)}))

def test_is_connected_two_non_adjacent():
    assert not is_connected(frozenset({(0, 0), (2, 0)}))

def test_is_connected_initial_board():
    assert is_connected(INITIAL_DISCS)

def test_edge_discs_subset_of_discs():
    assert edge_discs(INITIAL_DISCS).issubset(INITIAL_DISCS)

def test_center_not_in_edge_discs():
    assert (0, 0) not in edge_discs(INITIAL_DISCS)

def test_corners_are_edge_discs():
    edges = edge_discs(INITIAL_DISCS)
    assert INITIAL_CORNERS.issubset(edges)

def test_removable_discs_excludes_occupied():
    occupied = INITIAL_CORNERS
    removable = removable_discs(INITIAL_DISCS, occupied)
    assert removable.isdisjoint(occupied)

def test_removable_discs_stay_connected():
    occupied = INITIAL_CORNERS
    for pos in removable_discs(INITIAL_DISCS, occupied):
        assert is_connected(INITIAL_DISCS - {pos})

def test_valid_placements_touch_two_discs():
    remaining = INITIAL_DISCS - {(2, 0)}
    for pos in valid_placements(remaining, excluded=(2, 0)):
        count = sum(1 for n in hex_neighbors(pos) if n in remaining)
        assert count >= 2

def test_valid_placements_not_in_remaining():
    remaining = INITIAL_DISCS - {(2, 0)}
    for pos in valid_placements(remaining, excluded=(2, 0)):
        assert pos not in remaining

def test_valid_placements_excludes_original():
    remaining = INITIAL_DISCS - {(2, 0)}
    placements = valid_placements(remaining, excluded=(2, 0))
    assert (2, 0) not in placements
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/engine/test_board.py -v
```

Expected: `ImportError` or all `FAILED`.

- [ ] **Step 3: Implement engine/board.py**

```python
# engine/board.py
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
```

- [ ] **Step 4: Run to confirm passing**

```bash
pytest tests/engine/test_board.py -v
```

Expected: all `PASSED`.

- [ ] **Step 5: Commit**

```bash
git add engine/board.py tests/engine/test_board.py
git commit -m "feat: hex board coordinates, adjacency, connectivity"
```

---

## Task 3: GameState dataclass and initial setup

**Files:**
- Create: `engine/game.py` (state + initial_state only — more added in Task 5)
- Create: `tests/engine/test_game.py`

**Background:** `GameState` is a frozen dataclass (hashable, immutable). Initial corners go clockwise from right — even indices are red, odd are black, giving proper alternating placement.

- [ ] **Step 1: Write failing tests**

```python
# tests/engine/test_game.py
from engine.game import GameState, Move, initial_state
from engine.board import INITIAL_DISCS, INITIAL_CORNERS

def test_initial_disc_count():
    assert len(initial_state().discs) == 19

def test_initial_red_pawn_count():
    assert len(initial_state().red_pawns) == 3

def test_initial_black_pawn_count():
    assert len(initial_state().black_pawns) == 3

def test_initial_pawns_cover_all_corners():
    s = initial_state()
    assert set(s.red_pawns) | set(s.black_pawns) == INITIAL_CORNERS

def test_initial_pawns_no_overlap():
    s = initial_state()
    assert set(s.red_pawns).isdisjoint(set(s.black_pawns))

def test_initial_first_player_red():
    assert initial_state(first_player="red").current_player == "red"

def test_initial_first_player_black():
    assert initial_state(first_player="black").current_player == "black"

def test_initial_no_last_placed_disc():
    assert initial_state().last_placed_disc is None

def test_gamestate_is_hashable():
    s = initial_state()
    {s}  # must not raise
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/engine/test_game.py -v
```

Expected: `ImportError` or all `FAILED`.

- [ ] **Step 3: Implement engine/game.py (state only)**

```python
# engine/game.py
from __future__ import annotations
from dataclasses import dataclass
from typing import Callable
from engine.board import INITIAL_DISCS, INITIAL_CORNERS


@dataclass(frozen=True)
class GameState:
    discs: frozenset[tuple[int, int]]
    red_pawns: tuple[tuple[int, int], ...]
    black_pawns: tuple[tuple[int, int], ...]
    current_player: str  # "red" or "black"
    last_placed_disc: tuple[int, int] | None = None


@dataclass(frozen=True)
class Move:
    pawn_index: int
    pawn_from: tuple[int, int]
    pawn_to: tuple[int, int]
    disc_from: tuple[int, int]
    disc_to: tuple[int, int]


# Clockwise corner order ensures alternating red/black placement
_CORNER_ORDER: list[tuple[int, int]] = [
    (2, 0), (2, -2), (0, -2), (-2, 0), (-2, 2), (0, 2)
]


def initial_state(first_player: str = "red") -> GameState:
    red_pawns = tuple(_CORNER_ORDER[i] for i in range(0, 6, 2))
    black_pawns = tuple(_CORNER_ORDER[i] for i in range(1, 6, 2))
    return GameState(
        discs=INITIAL_DISCS,
        red_pawns=red_pawns,
        black_pawns=black_pawns,
        current_player=first_player,
        last_placed_disc=None,
    )
```

- [ ] **Step 4: Run to confirm passing**

```bash
pytest tests/engine/test_game.py -v
```

Expected: all `PASSED`.

- [ ] **Step 5: Commit**

```bash
git add engine/game.py tests/engine/test_game.py
git commit -m "feat: GameState and Move dataclasses, initial_state"
```

---

## Task 4: Legal move generation

**Files:**
- Create: `engine/moves.py`
- Create: `tests/engine/test_moves.py`

**Background:** A pawn slides in each of the 6 hex directions, advancing disc-by-disc until it exits the board or hits another pawn. All intermediate and final positions that land on a disc (and not a pawn) are valid destinations. After committing a pawn move, the updated occupied set is used to compute available disc relocations.

- [ ] **Step 1: Write failing tests**

```python
# tests/engine/test_moves.py
from engine.game import GameState, Move, initial_state
from engine.moves import pawn_destinations, disc_moves_after_pawn, legal_moves


def test_pawn_destinations_nonempty():
    state = initial_state(first_player="red")
    dests = pawn_destinations(state, state.red_pawns[0])
    assert len(dests) > 0


def test_pawn_destinations_land_on_disc():
    state = initial_state(first_player="red")
    for pawn in state.red_pawns:
        for dest in pawn_destinations(state, pawn):
            assert dest in state.discs


def test_pawn_destinations_no_pawn_on_dest():
    state = initial_state(first_player="red")
    all_pawns = set(state.red_pawns) | set(state.black_pawns)
    for pawn in state.red_pawns:
        for dest in pawn_destinations(state, pawn):
            assert dest not in all_pawns


def test_disc_moves_nonempty():
    state = initial_state()
    occupied = frozenset(state.red_pawns) | frozenset(state.black_pawns)
    result = disc_moves_after_pawn(state.discs, occupied, None)
    assert len(result) > 0


def test_disc_moves_excludes_last_placed():
    state = initial_state()
    occupied = frozenset(state.red_pawns) | frozenset(state.black_pawns)
    # Pick any removable disc as the "just placed" disc
    from engine.board import removable_discs
    removable = removable_discs(state.discs, occupied)
    last_placed = next(iter(removable))
    result = disc_moves_after_pawn(state.discs, occupied, last_placed)
    for (disc_from, _) in result:
        assert disc_from != last_placed


def test_legal_moves_returns_Move_objects():
    state = initial_state(first_player="red")
    for move in legal_moves(state):
        assert isinstance(move, Move)


def test_legal_moves_pawn_from_belongs_to_current_player():
    state = initial_state(first_player="red")
    for move in legal_moves(state):
        assert move.pawn_from in state.red_pawns


def test_legal_moves_disc_to_touches_two():
    from engine.board import hex_neighbors
    state = initial_state(first_player="red")
    for move in legal_moves(state):
        after_removal = state.discs - {move.disc_from}
        count = sum(1 for n in hex_neighbors(move.disc_to) if n in after_removal)
        assert count >= 2


def test_legal_moves_nonempty():
    assert len(legal_moves(initial_state())) > 0
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/engine/test_moves.py -v
```

Expected: `ImportError` or all `FAILED`.

- [ ] **Step 3: Implement engine/moves.py**

```python
# engine/moves.py
from __future__ import annotations
from engine.board import HEX_DIRECTIONS, removable_discs, valid_placements
from engine.game import GameState, Move


def pawn_destinations(
    state: GameState, pawn_pos: tuple[int, int]
) -> list[tuple[int, int]]:
    all_pawns = frozenset(state.red_pawns) | frozenset(state.black_pawns)
    destinations = []
    for dq, dr in HEX_DIRECTIONS:
        q, r = pawn_pos
        while True:
            q, r = q + dq, r + dr
            if (q, r) not in state.discs:
                break
            if (q, r) in all_pawns:
                break
            destinations.append((q, r))
    return destinations


def disc_moves_after_pawn(
    discs: frozenset[tuple[int, int]],
    occupied: frozenset[tuple[int, int]],
    last_placed_disc: tuple[int, int] | None,
) -> list[tuple[tuple[int, int], tuple[int, int]]]:
    removable = removable_discs(discs, occupied)
    if last_placed_disc is not None:
        removable = removable - {last_placed_disc}
    result = []
    for disc_from in removable:
        remaining = discs - {disc_from}
        for disc_to in valid_placements(remaining, excluded=disc_from):
            result.append((disc_from, disc_to))
    return result


def legal_moves(state: GameState) -> list[Move]:
    pawns = state.red_pawns if state.current_player == "red" else state.black_pawns
    all_pawns = frozenset(state.red_pawns) | frozenset(state.black_pawns)
    moves = []
    for pawn_index, pawn_from in enumerate(pawns):
        for pawn_to in pawn_destinations(state, pawn_from):
            new_occupied = (all_pawns - {pawn_from}) | {pawn_to}
            for disc_from, disc_to in disc_moves_after_pawn(
                state.discs, new_occupied, state.last_placed_disc
            ):
                moves.append(Move(
                    pawn_index=pawn_index,
                    pawn_from=pawn_from,
                    pawn_to=pawn_to,
                    disc_from=disc_from,
                    disc_to=disc_to,
                ))
    return moves
```

- [ ] **Step 4: Run to confirm passing**

```bash
pytest tests/engine/test_moves.py -v
```

Expected: all `PASSED`.

- [ ] **Step 5: Commit**

```bash
git add engine/moves.py tests/engine/test_moves.py
git commit -m "feat: legal move generation (pawn slides + disc relocations)"
```

---

## Task 5: apply_move, check_win, and play_game

**Files:**
- Modify: `engine/game.py` — add `apply_move`, `check_win`, `play_game`
- Modify: `tests/engine/test_game.py` — add new tests

**Background:** Win condition — 3 pawns form a connected cluster: at least two pairs among (A,B), (B,C), (A,C) are adjacent. `play_game` runs until a win is detected or `max_turns` is reached (draw). It returns a result dict with `winner`, `turns`, `moves` log, and `first_player`.

- [ ] **Step 1: Add tests to tests/engine/test_game.py**

Append to the existing file:

```python
from engine.game import apply_move, check_win, play_game
from engine.moves import legal_moves


def test_apply_move_pawn_moves():
    s = initial_state(first_player="red")
    move = legal_moves(s)[0]
    ns = apply_move(s, move)
    assert move.pawn_to in ns.red_pawns
    assert move.pawn_from not in ns.red_pawns


def test_apply_move_disc_updates():
    s = initial_state(first_player="red")
    move = legal_moves(s)[0]
    ns = apply_move(s, move)
    assert move.disc_from not in ns.discs
    assert move.disc_to in ns.discs


def test_apply_move_disc_count_unchanged():
    s = initial_state(first_player="red")
    ns = apply_move(s, legal_moves(s)[0])
    assert len(ns.discs) == len(s.discs)


def test_apply_move_switches_player():
    s = initial_state(first_player="red")
    assert apply_move(s, legal_moves(s)[0]).current_player == "black"


def test_apply_move_records_last_placed_disc():
    s = initial_state(first_player="red")
    move = legal_moves(s)[0]
    assert apply_move(s, move).last_placed_disc == move.disc_to


def test_check_win_none_at_start():
    assert check_win(initial_state()) is None


def test_check_win_line():
    s = GameState(
        discs=INITIAL_DISCS,
        red_pawns=((0, 0), (1, 0), (2, 0)),
        black_pawns=((-2, 0), (-2, 1), (-2, 2)),
        current_player="black",
    )
    assert check_win(s) == "red"


def test_check_win_triangle():
    s = GameState(
        discs=INITIAL_DISCS,
        red_pawns=((0, 0), (1, 0), (0, 1)),
        black_pawns=((-2, 0), (-2, 1), (-2, 2)),
        current_player="black",
    )
    assert check_win(s) == "red"


def test_check_win_tick():
    s = GameState(
        discs=INITIAL_DISCS,
        red_pawns=((0, 0), (1, 0), (1, -1)),
        black_pawns=((-2, 0), (-2, 1), (-2, 2)),
        current_player="black",
    )
    assert check_win(s) == "red"


def test_check_win_not_when_spread():
    s = GameState(
        discs=INITIAL_DISCS,
        red_pawns=((0, 0), (2, 0), (-2, 0)),
        black_pawns=((-2, 1), (-2, 2), (0, 2)),
        current_player="red",
    )
    assert check_win(s) is None


def test_play_game_winner_valid():
    import random
    def rand(state):
        return random.choice(legal_moves(state))
    result = play_game(rand, rand)
    assert result["winner"] in ("red", "black", "draw")


def test_play_game_moves_list():
    import random
    def rand(state):
        return random.choice(legal_moves(state))
    result = play_game(rand, rand)
    assert isinstance(result["moves"], list)
    assert len(result["moves"]) == result["turns"]


def test_play_game_respects_max_turns():
    def first(state):
        return legal_moves(state)[0]
    result = play_game(first, first, max_turns=3)
    assert result["turns"] <= 3
```

- [ ] **Step 2: Run to confirm new tests fail**

```bash
pytest tests/engine/test_game.py -v
```

Expected: new tests `FAILED`, original tests still `PASSED`.

- [ ] **Step 3: Add apply_move, check_win, play_game to engine/game.py**

Append to the existing `engine/game.py`:

```python
from engine.board import is_adjacent


def apply_move(state: GameState, move: Move) -> GameState:
    if state.current_player == "red":
        pawns = list(state.red_pawns)
        pawns[move.pawn_index] = move.pawn_to
        red_pawns, black_pawns = tuple(pawns), state.black_pawns
    else:
        pawns = list(state.black_pawns)
        pawns[move.pawn_index] = move.pawn_to
        red_pawns, black_pawns = state.red_pawns, tuple(pawns)

    return GameState(
        discs=(state.discs - {move.disc_from}) | {move.disc_to},
        red_pawns=red_pawns,
        black_pawns=black_pawns,
        current_player="black" if state.current_player == "red" else "red",
        last_placed_disc=move.disc_to,
    )


def _connected(pawns: tuple[tuple[int, int], ...]) -> bool:
    a, b, c = pawns
    ab, bc, ac = is_adjacent(a, b), is_adjacent(b, c), is_adjacent(a, c)
    return (ab and bc) or (ab and ac) or (bc and ac)


def check_win(state: GameState) -> str | None:
    if _connected(state.red_pawns):
        return "red"
    if _connected(state.black_pawns):
        return "black"
    return None


def play_game(
    red_strategy: Callable[["GameState"], "Move"],
    black_strategy: Callable[["GameState"], "Move"],
    first_player: str = "red",
    max_turns: int = 200,
) -> dict:
    from engine.moves import legal_moves
    state = initial_state(first_player=first_player)
    moves_log: list[dict] = []

    for turn in range(max_turns):
        winner = check_win(state)
        if winner:
            return {"winner": winner, "turns": turn, "moves": moves_log, "first_player": first_player}

        strategy = red_strategy if state.current_player == "red" else black_strategy
        move = strategy(state)
        moves_log.append({
            "turn": turn + 1,
            "player": state.current_player,
            "pawn_index": move.pawn_index,
            "pawn_from": list(move.pawn_from),
            "pawn_to": list(move.pawn_to),
            "disc_from": list(move.disc_from),
            "disc_to": list(move.disc_to),
        })
        state = apply_move(state, move)

    winner = check_win(state)
    return {"winner": winner or "draw", "turns": max_turns, "moves": moves_log, "first_player": first_player}
```

- [ ] **Step 4: Run all engine tests**

```bash
pytest tests/engine/ -v
```

Expected: all `PASSED`.

- [ ] **Step 5: Commit**

```bash
git add engine/game.py tests/engine/test_game.py
git commit -m "feat: apply_move, win detection, game loop"
```

---

## Task 6: Strategy engine and config files

**Files:**
- Create: `strategies/configs/random.json`
- Create: `strategies/configs/aggressive.json`
- Create: `strategies/configs/defensive.json`
- Create: `strategies/engine.py`
- Create: `tests/strategies/test_engine.py`

**Background:** `score_move` computes a weighted sum of 6 normalised heuristics. MAX_DIST = 4.0 (the maximum hex distance on a radius-2 board). `make_strategy_fn` returns a callable suitable for `play_game`.

- [ ] **Step 1: Create strategy configs**

`strategies/configs/random.json`:
```json
{
  "name": "Random",
  "description": "Picks moves uniformly at random",
  "heuristics": {
    "cluster_own": 0.0,
    "block_opponent": 0.0,
    "prefer_center": 0.0,
    "disc_help_self": 0.0,
    "disc_hurt_opp": 0.0,
    "randomness": 1.0
  }
}
```

`strategies/configs/aggressive.json`:
```json
{
  "name": "Aggressive Cluster",
  "description": "Rush own pawns together, use discs to help self",
  "heuristics": {
    "cluster_own": 0.9,
    "block_opponent": 0.2,
    "prefer_center": 0.3,
    "disc_help_self": 0.8,
    "disc_hurt_opp": 0.2,
    "randomness": 0.05
  }
}
```

`strategies/configs/defensive.json`:
```json
{
  "name": "Defensive Disruptor",
  "description": "Prioritises disrupting opponent over clustering own pawns",
  "heuristics": {
    "cluster_own": 0.3,
    "block_opponent": 0.9,
    "prefer_center": 0.4,
    "disc_help_self": 0.3,
    "disc_hurt_opp": 0.8,
    "randomness": 0.05
  }
}
```

- [ ] **Step 2: Write failing tests**

```python
# tests/strategies/test_engine.py
from engine.game import Move, initial_state
from engine.moves import legal_moves
from strategies.engine import load_strategy, score_move, choose_move, make_strategy_fn


def test_load_strategy_keys():
    config = load_strategy("strategies/configs/aggressive.json")
    assert "name" in config
    assert "heuristics" in config


def test_load_strategy_all_heuristics():
    h = load_strategy("strategies/configs/aggressive.json")["heuristics"]
    for key in ("cluster_own", "block_opponent", "prefer_center",
                "disc_help_self", "disc_hurt_opp", "randomness"):
        assert key in h


def test_score_move_returns_float():
    state = initial_state(first_player="red")
    h = load_strategy("strategies/configs/aggressive.json")["heuristics"]
    score = score_move(state, legal_moves(state)[0], h)
    assert isinstance(score, float)


def test_choose_move_returns_Move():
    state = initial_state(first_player="red")
    h = load_strategy("strategies/configs/aggressive.json")["heuristics"]
    assert isinstance(choose_move(state, h), Move)


def test_choose_move_is_legal():
    state = initial_state(first_player="red")
    h = load_strategy("strategies/configs/aggressive.json")["heuristics"]
    move = choose_move(state, h)
    assert move in legal_moves(state)


def test_make_strategy_fn_callable():
    h = load_strategy("strategies/configs/aggressive.json")["heuristics"]
    fn = make_strategy_fn(h)
    assert callable(fn)


def test_make_strategy_fn_returns_Move():
    h = load_strategy("strategies/configs/aggressive.json")["heuristics"]
    fn = make_strategy_fn(h)
    state = initial_state(first_player="red")
    assert isinstance(fn(state), Move)
```

- [ ] **Step 3: Run to confirm failure**

```bash
pytest tests/strategies/test_engine.py -v
```

Expected: `ImportError` or all `FAILED`.

- [ ] **Step 4: Implement strategies/engine.py**

```python
# strategies/engine.py
from __future__ import annotations
import json
import random
from typing import Callable
from engine.board import hex_distance, hex_neighbors
from engine.game import GameState, Move
from engine.moves import legal_moves

MAX_DIST = 4.0  # max hex distance on radius-2 board


def load_strategy(config_path: str) -> dict:
    with open(config_path) as f:
        return json.load(f)


def _avg_pairwise_dist(pawns: tuple[tuple[int, int], ...]) -> float:
    a, b, c = pawns
    return (hex_distance(a, b) + hex_distance(b, c) + hex_distance(a, c)) / 3.0


def _disc_neighbor_fraction(
    pawns: tuple[tuple[int, int], ...],
    discs: frozenset[tuple[int, int]],
) -> float:
    total = disc_count = 0
    for pawn in pawns:
        for n in hex_neighbors(pawn):
            total += 1
            if n in discs:
                disc_count += 1
    return disc_count / total if total else 0.0


def score_move(state: GameState, move: Move, heuristics: dict[str, float]) -> float:
    if state.current_player == "red":
        own = list(state.red_pawns)
        opp = state.black_pawns
    else:
        own = list(state.black_pawns)
        opp = state.red_pawns

    own[move.pawn_index] = move.pawn_to
    own_t = tuple(own)
    new_discs = (state.discs - {move.disc_from}) | {move.disc_to}

    score = 0.0

    if heuristics.get("cluster_own", 0.0):
        score += heuristics["cluster_own"] * (1.0 - _avg_pairwise_dist(own_t) / MAX_DIST)

    if heuristics.get("block_opponent", 0.0):
        score += heuristics["block_opponent"] * (_avg_pairwise_dist(opp) / MAX_DIST)

    if heuristics.get("prefer_center", 0.0):
        score += heuristics["prefer_center"] * (1.0 - hex_distance(move.pawn_to, (0, 0)) / MAX_DIST)

    if heuristics.get("disc_help_self", 0.0):
        score += heuristics["disc_help_self"] * _disc_neighbor_fraction(own_t, new_discs)

    if heuristics.get("disc_hurt_opp", 0.0):
        score += heuristics["disc_hurt_opp"] * (1.0 - _disc_neighbor_fraction(opp, new_discs))

    if heuristics.get("randomness", 0.0):
        score += heuristics["randomness"] * random.random()

    return score


def choose_move(state: GameState, heuristics: dict[str, float]) -> Move:
    moves = legal_moves(state)
    return max(moves, key=lambda m: score_move(state, m, heuristics))


def make_strategy_fn(heuristics: dict[str, float]) -> Callable[[GameState], Move]:
    def strategy(state: GameState) -> Move:
        return choose_move(state, heuristics)
    return strategy
```

- [ ] **Step 5: Run to confirm passing**

```bash
pytest tests/strategies/test_engine.py -v
```

Expected: all `PASSED`.

- [ ] **Step 6: Commit**

```bash
git add strategies/engine.py strategies/configs/ tests/strategies/test_engine.py
git commit -m "feat: strategy engine with heuristic scoring and config files"
```

---

## Task 7: Tournament runner and recorder

**Files:**
- Create: `runner/tournament.py`
- Create: `runner/recorder.py`
- Create: `tests/runner/test_tournament.py`

**Background:** `run_matchup` plays `n_games` between two strategies with a 50/50 first-player split. It tracks wins per side and computes best/median/worst winning game IDs for strategy A. `run_tournament` runs all pairs plus every strategy vs the random baseline.

- [ ] **Step 1: Write failing tests**

```python
# tests/runner/test_tournament.py
import os, json, tempfile
from strategies.engine import load_strategy, make_strategy_fn
from runner.tournament import run_matchup, run_tournament, load_all_strategies
from runner.recorder import save_results, load_results, load_latest_results


def _random_fn():
    return make_strategy_fn(load_strategy("strategies/configs/random.json")["heuristics"])


def test_run_matchup_game_count():
    fn = _random_fn()
    result = run_matchup("r1", fn, "r2", fn, n_games=4)
    assert len(result["games"]) == 4


def test_run_matchup_first_player_split():
    fn = _random_fn()
    result = run_matchup("r1", fn, "r2", fn, n_games=4)
    labels = [g["first_player"] for g in result["games"]]
    assert labels.count("r1") == 2
    assert labels.count("r2") == 2


def test_run_matchup_wins_sum_to_total():
    fn = _random_fn()
    s = run_matchup("r1", fn, "r2", fn, n_games=6)["summary"]
    assert s["a_wins"] + s["b_wins"] + s["draws"] == 6


def test_run_matchup_has_summary_keys():
    fn = _random_fn()
    s = run_matchup("r1", fn, "r2", fn, n_games=2)["summary"]
    for key in ("a_wins", "b_wins", "draws", "avg_turns",
                "best_a_win_game_id", "median_a_win_game_id", "worst_a_win_game_id"):
        assert key in s


def test_load_all_strategies_includes_random():
    strategies = load_all_strategies("strategies/configs")
    assert any(s["name"] == "random" for s in strategies)


def test_load_all_strategies_includes_all_jsons():
    strategies = load_all_strategies("strategies/configs")
    assert len(strategies) >= 3


def test_run_tournament_has_matchups():
    fn = _random_fn()
    strategies = [
        {"name": "a", "display_name": "A", "description": "", "fn": fn},
        {"name": "b", "display_name": "B", "description": "", "fn": fn},
    ]
    result = run_tournament(strategies, n_games=2)
    assert len(result["matchups"]) == 1


def test_save_and_load_results():
    with tempfile.TemporaryDirectory() as tmpdir:
        data = {"run_id": "test-123", "matchups": [], "strategies": [], "games_per_matchup": 2}
        path = save_results(data, tmpdir)
        assert os.path.exists(path)
        loaded = load_results(path)
        assert loaded["run_id"] == "test-123"


def test_load_latest_results_none_when_empty():
    with tempfile.TemporaryDirectory() as tmpdir:
        assert load_latest_results(tmpdir) is None
```

- [ ] **Step 2: Run to confirm failure**

```bash
pytest tests/runner/test_tournament.py -v
```

Expected: `ImportError` or all `FAILED`.

- [ ] **Step 3: Implement runner/tournament.py**

```python
# runner/tournament.py
from __future__ import annotations
import os
import statistics
from engine.game import play_game
from strategies.engine import load_strategy, make_strategy_fn


def load_all_strategies(configs_dir: str) -> list[dict]:
    strategies = []
    for filename in sorted(os.listdir(configs_dir)):
        if not filename.endswith(".json"):
            continue
        path = os.path.join(configs_dir, filename)
        config = load_strategy(path)
        name = filename[:-5]
        strategies.append({
            "name": name,
            "display_name": config["name"],
            "description": config.get("description", ""),
            "fn": make_strategy_fn(config["heuristics"]),
        })
    return strategies


def run_matchup(
    name_a: str, fn_a,
    name_b: str, fn_b,
    n_games: int = 100,
) -> dict:
    games = []
    half = n_games // 2

    for i in range(n_games):
        if i < half:
            # a plays red (first), b plays black
            result = play_game(fn_a, fn_b, first_player="red")
            winner = name_a if result["winner"] == "red" else (
                name_b if result["winner"] == "black" else "draw"
            )
            first_label = name_a
        else:
            # b plays red (first), a plays black
            result = play_game(fn_b, fn_a, first_player="red")
            winner = name_b if result["winner"] == "red" else (
                name_a if result["winner"] == "black" else "draw"
            )
            first_label = name_b

        games.append({
            "game_id": i,
            "first_player": first_label,
            "winner": winner,
            "turns": result["turns"],
            "moves": result["moves"],
        })

    a_wins_games = sorted(
        [g for g in games if g["winner"] == name_a], key=lambda g: g["turns"]
    )
    a_wins = len(a_wins_games)
    b_wins = sum(1 for g in games if g["winner"] == name_b)
    draws = sum(1 for g in games if g["winner"] == "draw")

    return {
        "strategy_a": name_a,
        "strategy_b": name_b,
        "games": games,
        "summary": {
            "a_wins": a_wins,
            "b_wins": b_wins,
            "draws": draws,
            "avg_turns": round(statistics.mean(g["turns"] for g in games), 1),
            "best_a_win_game_id": a_wins_games[0]["game_id"] if a_wins_games else None,
            "median_a_win_game_id": a_wins_games[len(a_wins_games) // 2]["game_id"] if a_wins_games else None,
            "worst_a_win_game_id": a_wins_games[-1]["game_id"] if a_wins_games else None,
        },
    }


def run_tournament(strategies: list[dict], n_games: int = 100) -> dict:
    matchups = []
    for i, s_a in enumerate(strategies):
        for s_b in strategies[i + 1:]:
            matchups.append(run_matchup(
                s_a["name"], s_a["fn"],
                s_b["name"], s_b["fn"],
                n_games=n_games,
            ))
    return {
        "strategies": [
            {"name": s["name"], "display_name": s["display_name"], "description": s["description"]}
            for s in strategies
        ],
        "games_per_matchup": n_games,
        "matchups": matchups,
    }
```

- [ ] **Step 4: Implement runner/recorder.py**

```python
# runner/recorder.py
from __future__ import annotations
import json
import os
from datetime import datetime


def save_results(data: dict, output_dir: str) -> str:
    os.makedirs(output_dir, exist_ok=True)
    run_id = data.get("run_id", datetime.now().strftime("%Y-%m-%dT%H-%M-%S"))
    filename = run_id.replace(":", "-") + ".json"
    path = os.path.join(output_dir, filename)
    with open(path, "w") as f:
        json.dump(data, f, indent=2)
    return path


def load_results(path: str) -> dict:
    with open(path) as f:
        return json.load(f)


def load_latest_results(results_dir: str) -> dict | None:
    if not os.path.isdir(results_dir):
        return None
    files = sorted(
        [f for f in os.listdir(results_dir) if f.endswith(".json")],
        reverse=True,
    )
    return load_results(os.path.join(results_dir, files[0])) if files else None
```

- [ ] **Step 5: Run all tests**

```bash
pytest -v
```

Expected: all `PASSED`.

- [ ] **Step 6: Commit**

```bash
git add runner/tournament.py runner/recorder.py tests/runner/test_tournament.py
git commit -m "feat: tournament runner and JSON recorder"
```

---

## Task 8: CLI entry point

**Files:**
- Create: `run.py`

No tests — thin wrapper over already-tested modules.

- [ ] **Step 1: Create run.py**

```python
# run.py
import argparse
import sys
from datetime import datetime

CONFIGS_DIR = "strategies/configs"
RESULTS_DIR = "results"


def cmd_run(games: int) -> str:
    from runner.tournament import load_all_strategies, run_tournament
    from runner.recorder import save_results

    print(f"Loading strategies from {CONFIGS_DIR}...")
    strategies = load_all_strategies(CONFIGS_DIR)
    print(f"Strategies: {[s['name'] for s in strategies]}")
    print(f"Running tournament ({games} games per matchup)...")

    results = run_tournament(strategies, n_games=games)
    results["run_id"] = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    path = save_results(results, RESULTS_DIR)
    print(f"Saved to {path}\n")

    for m in results["matchups"]:
        s = m["summary"]
        print(
            f"  {m['strategy_a']} vs {m['strategy_b']}: "
            f"{s['a_wins']}W / {s['b_wins']}L / {s['draws']}D  "
            f"(avg {s['avg_turns']} turns)"
        )
    return path


def cmd_serve(result_path: str | None, port: int) -> None:
    from runner.recorder import load_results, load_latest_results
    from dashboard.app import create_app

    data = load_results(result_path) if result_path else load_latest_results(RESULTS_DIR)
    if data is None:
        print("No results found. Run a tournament first: python run.py")
        sys.exit(1)

    app = create_app(data)
    print(f"Dashboard at http://localhost:{port}")
    app.run(debug=False, port=port)


def main() -> None:
    parser = argparse.ArgumentParser(description="Nonaga Strategy Lab")
    parser.add_argument("--games", type=int, default=100, help="Games per matchup (default 100)")
    parser.add_argument("--serve", action="store_true", help="Start dashboard instead of running tournament")
    parser.add_argument("--result", type=str, default=None, help="Result JSON to serve (default: latest)")
    parser.add_argument("--port", type=int, default=5000)
    args = parser.parse_args()

    if args.serve:
        cmd_serve(args.result, args.port)
    else:
        cmd_run(args.games)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Smoke test**

```bash
python run.py --games 4
```

Expected: prints strategy names, plays games, saves JSON to `results/`, prints win/loss summary.

- [ ] **Step 3: Commit**

```bash
git add run.py
git commit -m "feat: CLI entry point (--games, --serve, --result)"
```

---

## Task 9: Flask dashboard — leaderboard

**Files:**
- Create: `dashboard/app.py`
- Create: `dashboard/templates/base.html`
- Create: `dashboard/templates/leaderboard.html`
- Create: `dashboard/static/style.css`

- [ ] **Step 1: Create dashboard/app.py**

```python
# dashboard/app.py
from __future__ import annotations
import statistics
from flask import Flask, render_template, jsonify


def _leaderboard(data: dict) -> list[dict]:
    by_name = {s["name"]: s for s in data["strategies"]}
    wins = {n: 0 for n in by_name}
    total = {n: 0 for n in by_name}
    turns_sum = {n: 0 for n in by_name}
    vs_random_wins = {n: 0 for n in by_name}
    vs_random_total = {n: 0 for n in by_name}

    for m in data["matchups"]:
        a, b = m["strategy_a"], m["strategy_b"]
        s = m["summary"]
        games_count = len(m["games"])
        wins[a] += s["a_wins"]
        wins[b] += s["b_wins"]
        total[a] += games_count
        total[b] += games_count
        for g in m["games"]:
            turns_sum[a] += g["turns"]
            turns_sum[b] += g["turns"]
        if a == "random":
            vs_random_wins[b] += s["b_wins"]
            vs_random_total[b] += games_count
        elif b == "random":
            vs_random_wins[a] += s["a_wins"]
            vs_random_total[a] += games_count

    rows = []
    for name, info in by_name.items():
        t = total[name] or 1
        vrt = vs_random_total[name] or 0
        rows.append({
            "name": name,
            "display_name": info["display_name"],
            "win_rate": round(wins[name] / t * 100, 1),
            "vs_random": round(vs_random_wins[name] / vrt * 100, 1) if vrt else None,
            "avg_turns": round(turns_sum[name] / t, 1),
        })
    return sorted(rows, key=lambda r: r["win_rate"], reverse=True)


def _matrix(data: dict) -> dict:
    names = [s["name"] for s in data["strategies"]]
    cells: dict[str, dict[str, float | None]] = {a: {b: None for b in names} for a in names}
    for m in data["matchups"]:
        a, b = m["strategy_a"], m["strategy_b"]
        n = len(m["games"]) or 1
        cells[a][b] = round(m["summary"]["a_wins"] / n * 100, 1)
        cells[b][a] = round(m["summary"]["b_wins"] / n * 100, 1)
    return {"names": names, "cells": cells}


def create_app(tournament_data: dict) -> Flask:
    app = Flask(__name__)

    @app.route("/")
    def leaderboard():
        return render_template("leaderboard.html", rows=_leaderboard(tournament_data), data=tournament_data)

    @app.route("/matrix")
    def matrix():
        m = _matrix(tournament_data)
        return render_template("matrix.html", names=m["names"], cells=m["cells"])

    @app.route("/matchup/<strategy_a>/<strategy_b>")
    def matchup(strategy_a: str, strategy_b: str):
        for m in tournament_data["matchups"]:
            if {m["strategy_a"], m["strategy_b"]} == {strategy_a, strategy_b}:
                return render_template("replay.html", matchup=m,
                                       strategy_a=strategy_a, strategy_b=strategy_b)
        return "Matchup not found", 404

    @app.route("/api/game/<strategy_a>/<strategy_b>/<int:game_id>")
    def game_data(strategy_a: str, strategy_b: str, game_id: int):
        for m in tournament_data["matchups"]:
            if {m["strategy_a"], m["strategy_b"]} == {strategy_a, strategy_b}:
                for g in m["games"]:
                    if g["game_id"] == game_id:
                        return jsonify(g)
        return jsonify({"error": "not found"}), 404

    return app
```

- [ ] **Step 2: Create dashboard/templates/base.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Nonaga Strategy Lab</title>
  <link rel="stylesheet" href="/static/style.css">
</head>
<body>
  <nav>
    <span class="nav-brand">Nonaga Strategy Lab</span>
    <a href="/">Leaderboard</a>
    <a href="/matrix">Head-to-Head</a>
  </nav>
  <main>{% block content %}{% endblock %}</main>
</body>
</html>
```

- [ ] **Step 3: Create dashboard/templates/leaderboard.html**

```html
{% extends "base.html" %}
{% block content %}
<h1>Strategy Leaderboard</h1>
<p class="meta">{{ data.games_per_matchup }} games per matchup &middot; {{ data.strategies|length }} strategies</p>
<table>
  <thead>
    <tr><th>Rank</th><th>Strategy</th><th>vs Random</th><th>Overall win %</th><th>Avg turns</th></tr>
  </thead>
  <tbody>
    {% for row in rows %}
    <tr>
      <td>{{ loop.index }}</td>
      <td><a href="/matrix">{{ row.display_name }}</a></td>
      <td>{% if row.vs_random is not none %}{{ row.vs_random }}%{% else %}—{% endif %}</td>
      <td>
        <div class="bar-wrap"><div class="bar" style="width:{{ row.win_rate }}%"></div></div>
        {{ row.win_rate }}%
      </td>
      <td>{{ row.avg_turns }}</td>
    </tr>
    {% endfor %}
  </tbody>
</table>
{% endblock %}
```

- [ ] **Step 4: Create dashboard/static/style.css**

```css
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: system-ui, sans-serif; color: #222; background: #f5f5f5; }
nav { background: #1a1a2e; padding: 12px 24px; display: flex; align-items: center; gap: 20px; }
.nav-brand { color: #fff; font-weight: 700; font-size: 15px; margin-right: auto; }
nav a { color: #ccc; text-decoration: none; font-size: 14px; }
nav a:hover { color: #fff; }
main { max-width: 960px; margin: 32px auto; padding: 0 16px; }
h1 { font-size: 22px; margin-bottom: 6px; }
.meta { color: #666; font-size: 13px; margin-bottom: 18px; }
table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
th, td { padding: 11px 16px; text-align: left; font-size: 13px; }
th { background: #f0f0f0; font-weight: 600; color: #444; }
tr + tr td { border-top: 1px solid #eee; }
.bar-wrap { display: inline-block; vertical-align: middle; background: #e8e8e8; border-radius: 4px; height: 8px; width: 100px; overflow: hidden; margin-right: 6px; }
.bar { background: #22c55e; height: 100%; }
.win  { background: #dcfce7; color: #166534; }
.loss { background: #fee2e2; color: #991b1b; }
.near { background: #fef9c3; color: #854d0e; }
.self { background: #e2e8f0; color: #888; text-align: center; }
.matrix-cell { text-align: center; cursor: pointer; font-size: 13px; }
.matrix-cell:hover { opacity: 0.8; }
.game-selector { display: flex; gap: 8px; margin: 14px 0; }
.gbtn { padding: 6px 14px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; background: #fff; font-size: 13px; }
.gbtn.active { background: #22c55e; color: #fff; border-color: #22c55e; }
.controls { display: flex; gap: 8px; margin-top: 10px; }
.controls button { padding: 6px 12px; border: 1px solid #ccc; border-radius: 4px; cursor: pointer; background: #fff; font-size: 13px; }
#board { margin: 16px 0; }
#turn-info { font-size: 13px; color: #555; margin: 6px 0; }
.move-log { max-height: 180px; overflow-y: auto; font-size: 12px; font-family: monospace; background: #f8f8f8; padding: 10px; border-radius: 4px; margin-top: 10px; line-height: 1.7; }
.move-log .active { background: #dcfce7; border-radius: 2px; }
a { color: #2563eb; text-decoration: none; }
a:hover { text-decoration: underline; }
```

- [ ] **Step 5: Smoke test leaderboard**

```bash
python run.py --games 4
python run.py --serve
```

Open http://localhost:5000 — leaderboard table renders with strategies, win rates, and bar charts.

- [ ] **Step 6: Commit**

```bash
git add dashboard/app.py dashboard/templates/base.html dashboard/templates/leaderboard.html dashboard/static/style.css
git commit -m "feat: Flask dashboard with leaderboard view"
```

---

## Task 10: Dashboard — matrix and game replay

**Files:**
- Create: `dashboard/templates/matrix.html`
- Create: `dashboard/templates/replay.html`
- Create: `dashboard/static/board.js`

- [ ] **Step 1: Create dashboard/templates/matrix.html**

```html
{% extends "base.html" %}
{% block content %}
<h1>Head-to-Head Matrix</h1>
<p class="meta">Win rate of the row strategy vs column strategy. Click a cell to replay games.</p>
<table>
  <thead>
    <tr>
      <th></th>
      {% for name in names %}<th>{{ name }}</th>{% endfor %}
    </tr>
  </thead>
  <tbody>
    {% for row in names %}
    <tr>
      <th>{{ row }}</th>
      {% for col in names %}
        {% if row == col %}
          <td class="self">—</td>
        {% else %}
          {% set val = cells[row][col] %}
          {% if val is none %}
            <td class="self">—</td>
          {% elif val > 55 %}
            <td class="matrix-cell win" onclick="location.href='/matchup/{{ row }}/{{ col }}'">{{ val }}%</td>
          {% elif val < 45 %}
            <td class="matrix-cell loss" onclick="location.href='/matchup/{{ row }}/{{ col }}'">{{ val }}%</td>
          {% else %}
            <td class="matrix-cell near" onclick="location.href='/matchup/{{ row }}/{{ col }}'">{{ val }}%</td>
          {% endif %}
        {% endif %}
      {% endfor %}
    </tr>
    {% endfor %}
  </tbody>
</table>
{% endblock %}
```

- [ ] **Step 2: Create dashboard/templates/replay.html**

```html
{% extends "base.html" %}
{% block content %}
<h1>{{ matchup.strategy_a }} vs {{ matchup.strategy_b }}</h1>
<p class="meta">
  {{ matchup.summary.a_wins }}W / {{ matchup.summary.b_wins }}L / {{ matchup.summary.draws }}D
  &middot; avg {{ matchup.summary.avg_turns }} turns
</p>

<div class="game-selector">
  {% if matchup.summary.best_a_win_game_id is not none %}
  <button class="gbtn active" onclick="loadGame({{ matchup.summary.best_a_win_game_id }}, this)">Best win</button>
  {% endif %}
  {% if matchup.summary.median_a_win_game_id is not none %}
  <button class="gbtn" onclick="loadGame({{ matchup.summary.median_a_win_game_id }}, this)">Median win</button>
  {% endif %}
  {% if matchup.summary.worst_a_win_game_id is not none %}
  <button class="gbtn" onclick="loadGame({{ matchup.summary.worst_a_win_game_id }}, this)">Worst win</button>
  {% endif %}
</div>

<div id="board"></div>
<div class="controls">
  <button onclick="goFirst()">⏮ First</button>
  <button onclick="goPrev()">◀ Prev</button>
  <button onclick="goNext()">Next ▶</button>
  <button onclick="goLast()">Last ⏭</button>
</div>
<div id="turn-info"></div>
<div id="move-log" class="move-log"></div>

<script src="/static/board.js"></script>
<script>
  const SA = "{{ matchup.strategy_a }}";
  const SB = "{{ matchup.strategy_b }}";
  const INIT_ID = {{ matchup.summary.best_a_win_game_id if matchup.summary.best_a_win_game_id is not none else 0 }};
  document.addEventListener("DOMContentLoaded", () => {
    const btn = document.querySelector(".gbtn.active");
    loadGame(INIT_ID, btn);
  });
</script>
{% endblock %}
```

- [ ] **Step 3: Create dashboard/static/board.js**

```javascript
// dashboard/static/board.js
const HEX_DIRS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];
let currentMoves = [], currentTurn = 0;

function initialDiscs() {
  const d = [];
  for (let q = -2; q <= 2; q++)
    for (let r = -2; r <= 2; r++)
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q+r)) <= 2)
        d.push([q, r]);
  return d;
}

function initialPawns() {
  // Clockwise from right, same order as engine/_CORNER_ORDER
  const corners = [[2,0],[2,-2],[0,-2],[-2,0],[-2,2],[0,2]];
  return {
    red:   [corners[0], corners[2], corners[4]],
    black: [corners[1], corners[3], corners[5]],
  };
}

function replayToTurn(moves, turnIndex) {
  const discs = new Set(initialDiscs().map(d => d.join(",")));
  const pawns = { red: initialPawns().red.map(p=>[...p]), black: initialPawns().black.map(p=>[...p]) };
  for (let i = 0; i < turnIndex && i < moves.length; i++) {
    const m = moves[i];
    pawns[m.player][m.pawn_index] = [...m.pawn_to];
    discs.delete(m.disc_from.join(","));
    discs.add(m.disc_to.join(","));
  }
  return { discs: [...discs].map(s => s.split(",").map(Number)), pawns };
}

function axialToPixel(q, r, size, cx, cy) {
  return [cx + size * 1.5 * q, cy + size * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r)];
}

function renderBoard(discs, pawns, turn, total) {
  const SIZE = 22, W = 360, H = 340, cx = W/2, cy = H/2;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  for (const [q, r] of discs) {
    const [px, py] = axialToPixel(q, r, SIZE, cx, cy);
    const el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    el.setAttribute("cx", px); el.setAttribute("cy", py);
    el.setAttribute("r", SIZE - 2);
    el.setAttribute("fill", "#e8dfd0"); el.setAttribute("stroke", "#b0a090"); el.setAttribute("stroke-width", "1.5");
    svg.appendChild(el);
  }

  const colors = { red: ["#c0392b","#922b21"], black: ["#2c2c2c","#000"] };
  for (const [color, list] of Object.entries(pawns)) {
    for (const [q, r] of list) {
      const [px, py] = axialToPixel(q, r, SIZE, cx, cy);
      const el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      el.setAttribute("cx", px); el.setAttribute("cy", py);
      el.setAttribute("r", SIZE * 0.44);
      el.setAttribute("fill", colors[color][0]); el.setAttribute("stroke", colors[color][1]); el.setAttribute("stroke-width", "2");
      svg.appendChild(el);
    }
  }

  document.getElementById("board").replaceChildren(svg);
  document.getElementById("turn-info").textContent =
    turn === 0 ? "Start position" : `Turn ${turn} of ${total}${turn===total?" — game over":""}`;
}

function renderLog(moves, turn) {
  const log = document.getElementById("move-log");
  log.innerHTML = moves.map((m, i) => {
    const cls = i + 1 === turn ? "active" : "";
    return `<div class="${cls}">T${m.turn} ${m.player}: pawn[${m.pawn_index}] ${m.pawn_from}→${m.pawn_to} | disc ${m.disc_from}→${m.disc_to}</div>`;
  }).join("");
  const active = log.querySelector(".active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function render() {
  const { discs, pawns } = replayToTurn(currentMoves, currentTurn);
  renderBoard(discs, pawns, currentTurn, currentMoves.length);
  renderLog(currentMoves, currentTurn);
}

function goFirst() { currentTurn = 0; render(); }
function goPrev()  { if (currentTurn > 0) { currentTurn--; render(); } }
function goNext()  { if (currentTurn < currentMoves.length) { currentTurn++; render(); } }
function goLast()  { currentTurn = currentMoves.length; render(); }

async function loadGame(gameId, btn) {
  document.querySelectorAll(".gbtn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  const res = await fetch(`/api/game/${SA}/${SB}/${gameId}`);
  const game = await res.json();
  currentMoves = game.moves;
  currentTurn = 0;
  render();
}
```

- [ ] **Step 4: Full dashboard smoke test**

```bash
python run.py --games 10
python run.py --serve
```

Verify:
1. http://localhost:5000 — leaderboard renders
2. Click "Head-to-Head" — matrix renders with green/red/yellow cells
3. Click a cell — replay page loads with strategy stats
4. Click "Best win" / "Median win" / "Worst win" — board updates with correct game
5. Click Prev / Next — board steps through turns, move log scrolls to current move
6. Click First / Last — jumps to start/end correctly

- [ ] **Step 5: Commit**

```bash
git add dashboard/templates/matrix.html dashboard/templates/replay.html dashboard/static/board.js
git commit -m "feat: matrix view and SVG game replay with step-through controls"
```

---

## Task 11: Final cleanup

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Update .gitignore**

Add to `.gitignore`:
```
results/*.json
__pycache__/
*.pyc
.pytest_cache/
```

- [ ] **Step 2: Run full test suite one final time**

```bash
pytest -v
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore result files and caches"
```

---

## Self-Review

**Spec coverage:**
- ✅ Game engine (board, moves, win detection, game loop) — Tasks 2–5
- ✅ 6 heuristics with 0–1 weights — Task 6
- ✅ Strategy configs (random, aggressive, defensive) — Task 6
- ✅ Round-robin + random baseline tournament — Task 7
- ✅ 50/50 first-player split — Task 7 `run_matchup`
- ✅ Timestamped JSON results — Task 7 `save_results`
- ✅ Result schema (run_id, games, summary, best/median/worst) — Task 7
- ✅ CLI flags (--games, --serve, --result) — Task 8
- ✅ Leaderboard with win rate bars and vs-random column — Task 9
- ✅ Head-to-head matrix with colour coding — Task 10
- ✅ Game replay with hex SVG board, best/median/worst, step controls, move log — Task 10
- ✅ Max-turns draw condition (200 turns) — Task 5

**Type consistency:**
- `GameState.red_pawns: tuple[tuple[int,int],...]` — consistent across board, game, moves, strategies ✓
- `Move` fields (pawn_index, pawn_from, pawn_to, disc_from, disc_to) — consistent ✓
- `run_matchup(name_a, fn_a, name_b, fn_b, n_games)` — matches tests ✓
- `play_game` returns `{"winner", "turns", "moves", "first_player"}` — used correctly in `run_matchup` ✓
- `board.js` `initialPawns()` corner order matches `engine/game.py` `_CORNER_ORDER` ✓

**No placeholders found.**
