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
