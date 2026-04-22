from __future__ import annotations
import os
import statistics
from datetime import datetime
from typing import Callable
from engine.game import play_game
from strategies.engine import load_strategy, make_strategy_fn


def load_all_strategies(configs_dir: str) -> dict[str, Callable]:
    strategies = {}
    for filename in sorted(os.listdir(configs_dir)):
        if not filename.endswith(".json"):
            continue
        path = os.path.join(configs_dir, filename)
        config = load_strategy(path)
        name = filename[:-5]
        strategies[name] = make_strategy_fn(config["heuristics"])
    return strategies


def _progress(label: str, done: int, total: int, round_num: int, total_rounds: int) -> None:
    width = 30
    filled = int(width * done / total)
    bar = "=" * filled + "-" * (width - filled)
    print(f"\rRound {round_num}/{total_rounds}: {label} [{bar}] {done}/{total}", end="", flush=True)


def run_matchup(
    name_a: str, fn_a,
    name_b: str, fn_b,
    n_games: int = 100,
    round_num: int = 1,
    total_rounds: int = 1,
) -> dict:
    games = []
    half = n_games // 2
    label = f"{name_a} vs {name_b}"

    for i in range(n_games):
        _progress(label, i, n_games, round_num, total_rounds)
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

    _progress(label, n_games, n_games, round_num, total_rounds)
    print()

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


def run_tournament(strategies: dict[str, Callable], n_games: int = 100) -> dict:
    names = list(strategies.keys())
    non_random = [n for n in names if n != "random"]

    pairs = [(a, b) for i, a in enumerate(non_random) for b in non_random[i + 1:]]
    baseline_pairs = [(n, "random") for n in non_random] if "random" in names else []
    all_pairs = pairs + baseline_pairs
    total_rounds = len(all_pairs)

    matchups = []
    for round_num, (name_a, name_b) in enumerate(all_pairs, start=1):
        matchups.append(run_matchup(
            name_a, strategies[name_a],
            name_b, strategies[name_b],
            n_games=n_games,
            round_num=round_num,
            total_rounds=total_rounds,
        ))

    return {
        "run_id": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "strategies": names,
        "games_per_matchup": n_games,
        "matchups": matchups,
    }
