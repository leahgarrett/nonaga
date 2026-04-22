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
    red_strategy: Callable[[GameState], Move],
    black_strategy: Callable[[GameState], Move],
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

        if not legal_moves(state):
            return {"winner": "draw", "turns": turn, "moves": moves_log, "first_player": first_player}

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
