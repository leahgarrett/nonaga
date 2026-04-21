from __future__ import annotations
import os
import statistics
from engine.game import play_game
from strategies.engine import load_strategy, make_strategy_fn


def load_all_strategies(configs_dir: str) -> list[dict]:
    strategies = []
    for filename in sorted(os.listdir(configs_dir)):
        if not filename.endswith(".json"):
            continue
        path = os.path.join(configs_dir, filename)
        config = load_strategy(path)
        name = filename[:-5]
        strategies.append({
            "name": name,
            "display_name": config["name"],
            "description": config.get("description", ""),
            "fn": make_strategy_fn(config["heuristics"]),
        })
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


def run_tournament(strategies: list[dict], n_games: int = 100) -> dict:
    matchups = []
    for i, s_a in enumerate(strategies):
        for s_b in strategies[i + 1:]:
            matchups.append(run_matchup(
                s_a["name"], s_a["fn"],
                s_b["name"], s_b["fn"],
                n_games=n_games,
            ))
    return {
        "strategies": [
            {"name": s["name"], "display_name": s["display_name"], "description": s["description"]}
            for s in strategies
        ],
        "games_per_matchup": n_games,
        "matchups": matchups,
    }
