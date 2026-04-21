from __future__ import annotations
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
