from __future__ import annotations
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


def test_pawn_slides_to_terminal_position_only():
    # Per Nonaga rules, a pawn must slide as far as it can in the chosen
    # direction until it hits the board edge or another pawn — it cannot
    # stop at an intermediate disc.
    state = initial_state(first_player="red")
    # From red corner (2, 0), the only legal landings are the terminal
    # positions in each open direction:
    #   - direction (0, -1): blocked by black at (2, -2), terminal = (2, -1)
    #   - direction (-1, 0): blocked by black at (-2, 0),  terminal = (-1, 0)
    #   - direction (-1, 1): blocked by black at (0, 2),   terminal = (1, 1)
    # All other directions step off the board immediately.
    assert set(pawn_destinations(state, (2, 0))) == {(2, -1), (-1, 0), (1, 1)}


def test_disc_moves_nonempty():
    state = initial_state()
    occupied = frozenset(state.red_pawns) | frozenset(state.black_pawns)
    result = disc_moves_after_pawn(state.discs, occupied, None)
    assert len(result) > 0


def test_disc_moves_excludes_last_placed():
    state = initial_state()
    occupied = frozenset(state.red_pawns) | frozenset(state.black_pawns)
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
