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
