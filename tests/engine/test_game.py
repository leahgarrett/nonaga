from __future__ import annotations
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
