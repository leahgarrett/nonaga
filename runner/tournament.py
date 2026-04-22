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


def run_matchup(
    name_a: str, fn_a,
    name_b: str, fn_b,
    n_games: int = 100,
) -> dict:
    games = []
    half = n_games // 2

    for i in range(n_games):
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
    matchups = []

    # Round-robin pairs (non-random strategies only)
    for i, name_a in enumerate(names):
        for name_b in names[i + 1:]:
            if name_a == "random" or name_b == "random":
                continue
            matchups.append(run_matchup(
                name_a, strategies[name_a],
                name_b, strategies[name_b],
                n_games=n_games,
            ))

    # Baseline matchups: every non-random strategy vs random
    random_fn = strategies.get("random")
    if random_fn is not None:
        for name in names:
            if name != "random":
                matchups.append(run_matchup(
                    name, strategies[name],
                    "random", random_fn,
                    n_games=n_games,
                ))

    return {
        "run_id": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"),
        "strategies": names,
        "games_per_matchup": n_games,
        "matchups": matchups,
    }
