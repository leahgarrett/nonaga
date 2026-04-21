# dashboard/app.py
from __future__ import annotations
import statistics
from flask import Flask, render_template, jsonify


def _leaderboard(data: dict) -> list[dict]:
    names = data["strategies"]
    wins = {n: 0 for n in names}
    total = {n: 0 for n in names}
    turns_sum = {n: 0 for n in names}
    vs_random_wins = {n: 0 for n in names}
    vs_random_total = {n: 0 for n in names}

    for m in data["matchups"]:
        a, b = m["strategy_a"], m["strategy_b"]
        s = m["summary"]
        games_count = len(m["games"])
        wins[a] += s["a_wins"]
        wins[b] += s["b_wins"]
        total[a] += games_count
        total[b] += games_count
        for g in m["games"]:
            turns_sum[a] += g["turns"]
            turns_sum[b] += g["turns"]
        if a == "random":
            vs_random_wins[b] += s["b_wins"]
            vs_random_total[b] += games_count
        elif b == "random":
            vs_random_wins[a] += s["a_wins"]
            vs_random_total[a] += games_count

    rows = []
    for name in names:
        t = total[name] or 1
        vrt = vs_random_total[name] or 0
        rows.append({
            "name": name,
            "display_name": name,
            "win_rate": round(wins[name] / t * 100, 1),
            "vs_random": round(vs_random_wins[name] / vrt * 100, 1) if vrt else None,
            "avg_turns": round(turns_sum[name] / t, 1),
        })
    return sorted(rows, key=lambda r: r["win_rate"], reverse=True)


def _matrix(data: dict) -> dict:
    names = data["strategies"]
    cells: dict[str, dict[str, float | None]] = {a: {b: None for b in names} for a in names}
    for m in data["matchups"]:
        a, b = m["strategy_a"], m["strategy_b"]
        n = len(m["games"]) or 1
        cells[a][b] = round(m["summary"]["a_wins"] / n * 100, 1)
        cells[b][a] = round(m["summary"]["b_wins"] / n * 100, 1)
    return {"names": names, "cells": cells}


def create_app(tournament_data: dict) -> Flask:
    app = Flask(__name__)

    @app.route("/")
    def leaderboard():
        return render_template("leaderboard.html", rows=_leaderboard(tournament_data), data=tournament_data)

    @app.route("/matrix")
    def matrix():
        m = _matrix(tournament_data)
        return render_template("matrix.html", names=m["names"], cells=m["cells"])

    @app.route("/matchup/<strategy_a>/<strategy_b>")
    def matchup(strategy_a: str, strategy_b: str):
        for m in tournament_data["matchups"]:
            if {m["strategy_a"], m["strategy_b"]} == {strategy_a, strategy_b}:
                return render_template("replay.html", matchup=m,
                                       strategy_a=strategy_a, strategy_b=strategy_b)
        return "Matchup not found", 404

    @app.route("/api/game/<strategy_a>/<strategy_b>/<int:game_id>")
    def game_data(strategy_a: str, strategy_b: str, game_id: int):
        for m in tournament_data["matchups"]:
            if {m["strategy_a"], m["strategy_b"]} == {strategy_a, strategy_b}:
                for g in m["games"]:
                    if g["game_id"] == game_id:
                        return jsonify(g)
        return jsonify({"error": "not found"}), 404

    return app
