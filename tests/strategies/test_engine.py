from __future__ import annotations
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
