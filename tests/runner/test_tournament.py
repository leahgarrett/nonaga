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
    assert "random" in strategies


def test_load_all_strategies_includes_all_jsons():
    strategies = load_all_strategies("strategies/configs")
    assert len(strategies) >= 3


def test_load_all_strategies_returns_callables():
    strategies = load_all_strategies("strategies/configs")
    for name, fn in strategies.items():
        assert callable(fn), f"strategy '{name}' is not callable"


def test_run_tournament_has_matchups():
    fn = _random_fn()
    strategies = {"a": fn, "b": fn}
    result = run_tournament(strategies, n_games=2)
    # round-robin: 1 pair; both non-random vs random: but neither is "random",
    # so no baseline matchups added (no "random" key present)
    assert len(result["matchups"]) == 1


def test_run_tournament_has_run_id():
    fn = _random_fn()
    strategies = {"a": fn, "b": fn}
    result = run_tournament(strategies, n_games=2)
    assert "run_id" in result
    assert "T" in result["run_id"]


def test_run_tournament_strategies_is_list_of_names():
    fn = _random_fn()
    strategies = {"a": fn, "b": fn}
    result = run_tournament(strategies, n_games=2)
    assert result["strategies"] == ["a", "b"]


def test_run_tournament_random_baseline_matchups():
    fn = _random_fn()
    strategies = {"aggressive": fn, "defensive": fn, "random": fn}
    result = run_tournament(strategies, n_games=2)
    # round-robin non-random pairs: 1 (aggressive vs defensive)
    # baseline pairs: 2 (aggressive vs random, defensive vs random)
    assert len(result["matchups"]) == 3
    # both non-random strategies appear as strategy_a in baseline matchups
    baseline = [m for m in result["matchups"] if m["strategy_b"] == "random"]
    names = {m["strategy_a"] for m in baseline}
    assert "aggressive" in names
    assert "defensive" in names


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


def test_load_latest_results_returns_most_recent():
    with tempfile.TemporaryDirectory() as tmpdir:
        older = {"run_id": "2026-04-20T10-00-00", "label": "older"}
        newer = {"run_id": "2026-04-21T12-00-00", "label": "newer"}
        save_results(older, tmpdir)
        save_results(newer, tmpdir)
        result = load_latest_results(tmpdir)
        assert result["label"] == "newer"
