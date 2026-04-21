from __future__ import annotations
import json
import random
from typing import Callable
from engine.board import hex_distance, hex_neighbors
from engine.game import GameState, Move
from engine.moves import legal_moves

MAX_DIST = 4.0


def load_strategy(config_path: str) -> dict:
    with open(config_path) as f:
        return json.load(f)


def _avg_pairwise_dist(pawns: tuple[tuple[int, int], ...]) -> float:
    a, b, c = pawns
    return (hex_distance(a, b) + hex_distance(b, c) + hex_distance(a, c)) / 3.0


def _disc_neighbor_fraction(
    pawns: tuple[tuple[int, int], ...],
    discs: frozenset[tuple[int, int]],
) -> float:
    total = disc_count = 0
    for pawn in pawns:
        for n in hex_neighbors(pawn):
            total += 1
            if n in discs:
                disc_count += 1
    return disc_count / total if total else 0.0


def score_move(state: GameState, move: Move, heuristics: dict[str, float]) -> float:
    if state.current_player == "red":
        own = list(state.red_pawns)
        opp = state.black_pawns
    else:
        own = list(state.black_pawns)
        opp = state.red_pawns

    own[move.pawn_index] = move.pawn_to
    own_t = tuple(own)
    new_discs = (state.discs - {move.disc_from}) | {move.disc_to}

    score = 0.0

    if heuristics.get("cluster_own", 0.0):
        score += heuristics["cluster_own"] * (1.0 - _avg_pairwise_dist(own_t) / MAX_DIST)

    if heuristics.get("block_opponent", 0.0):
        score += heuristics["block_opponent"] * (_avg_pairwise_dist(opp) / MAX_DIST)

    if heuristics.get("prefer_center", 0.0):
        score += heuristics["prefer_center"] * (1.0 - hex_distance(move.pawn_to, (0, 0)) / MAX_DIST)

    if heuristics.get("disc_help_self", 0.0):
        score += heuristics["disc_help_self"] * _disc_neighbor_fraction(own_t, new_discs)

    if heuristics.get("disc_hurt_opp", 0.0):
        score += heuristics["disc_hurt_opp"] * (1.0 - _disc_neighbor_fraction(opp, new_discs))

    if heuristics.get("randomness", 0.0):
        score += heuristics["randomness"] * random.random()

    return score


def choose_move(state: GameState, heuristics: dict[str, float]) -> Move:
    moves = legal_moves(state)
    return max(moves, key=lambda m: score_move(state, m, heuristics))


def make_strategy_fn(heuristics: dict[str, float]) -> Callable[[GameState], Move]:
    def strategy(state: GameState) -> Move:
        return choose_move(state, heuristics)
    return strategy
