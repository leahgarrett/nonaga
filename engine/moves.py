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
