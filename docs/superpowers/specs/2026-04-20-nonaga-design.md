# Nonaga Strategy Lab — Design Spec

**Date:** 2026-04-20  
**Status:** Approved

## Overview

A self-play harness for the board game Nonaga. Strategies are defined as JSON config files with heuristic weights. A tournament runner pits every strategy against every other (and a random baseline) for 100 games per matchup. Results are stored as JSON. A Flask web dashboard lets you explore win rates, head-to-head results, and replay individual games.

The workflow is: drop a new JSON config in `strategies/configs/` → run the tournament → review the dashboard → refine or add strategies → repeat.

---

## Game Rules (Nonaga)

- 2 players (Red and Black), 3 pawns each, 19 discs arranged in a hexagon.
- Starting position: pawns on the 6 corner discs, alternating colours.
- **Each turn has two mandatory steps:**
  1. **Move a pawn** — slide one of your pawns in a straight line until it hits the board edge or another pawn.
  2. **Relocate a disc** — take one free (no pawn) disc from the edge of the board and place it elsewhere. The placed disc must touch at least 2 other discs. The opponent may not move this disc on their immediately following turn.
- **Win condition:** be first to have all 3 of your pawns on mutually neighbouring discs — in a line, triangle, or tick shape.

---

## Project Structure

```
nonaga/
  engine/           # Game rules — pure Python, no external dependencies
    board.py        # Disc layout, adjacency, hex coordinate system
    moves.py        # Legal move generation (pawn moves + disc relocations)
    game.py         # Game loop, turn management, win detection
    state.py        # Serialisable game state dataclass

  strategies/
    configs/        # One JSON file per strategy
      random.json   # Built-in baseline (always included, not editable)
      aggressive.json
      defensive.json
    engine.py       # Reads a config, scores all legal moves, picks best

  runner/
    tournament.py   # Round-robin + baseline matchups, saves results
    recorder.py     # Writes timestamped JSON to results/

  results/          # Output — one JSON file per tournament run

  dashboard/
    app.py          # Flask server
    templates/      # Jinja2 HTML templates
    static/         # CSS + JS for board rendering and replay controls

  run.py            # CLI entry point
```

---

## Strategy Config Format

Each strategy is a JSON file in `strategies/configs/`. The `random` baseline is built-in and always included in every tournament.

```json
{
  "name": "Aggressive Cluster",
  "description": "Rush own pawns together, ignore opponent",
  "heuristics": {
    "cluster_own":      0.9,
    "block_opponent":   0.2,
    "prefer_center":    0.3,
    "disc_help_self":   0.8,
    "disc_hurt_opp":    0.2,
    "randomness":       0.05
  }
}
```

### Heuristics

| Key | Scores for |
|-----|-----------|
| `cluster_own` | Pawn moves that reduce average distance between your 3 pawns |
| `block_opponent` | Pawn moves that increase average distance between opponent's 3 pawns |
| `prefer_center` | Pawn moves that land closer to the centre of the current board |
| `disc_help_self` | Disc relocations that create or improve stepping-stone positions for your pawns |
| `disc_hurt_opp` | Disc relocations that remove useful positions from the opponent's path |
| `randomness` | Uniform noise added to all move scores — prevents identical games |

All weights are floats in `[0.0, 1.0]`. The strategy engine evaluates every legal move, computes a weighted score across applicable heuristics, and selects the highest-scoring move.

---

## Tournament Structure

- **Matchups:** every strategy pair (A vs B) plays 100 games — 50 with A as first player, 50 with B as first player.
- **Baseline:** every strategy also plays 100 games against the built-in `random` strategy (same 50/50 split).
- **Output:** one timestamped JSON file per tournament run in `results/`.

### Result File Schema

```json
{
  "run_id": "2026-04-20T14:32:00",
  "games_per_matchup": 100,
  "strategies": ["aggressive", "defensive", "center_control", "random"],
  "matchups": [
    {
      "strategy_a": "aggressive",
      "strategy_b": "defensive",
      "games": [
        {
          "first_player": "aggressive",
          "winner": "aggressive",
          "turns": 14,
          "moves": [
            {
              "turn": 1,
              "player": "aggressive",
              "pawn": 0,
              "pawn_from": [0, 2],
              "pawn_to": [0, 1],
              "disc_from": [2, 4],
              "disc_to": [3, 3]
            }
          ]
        }
      ],
      "summary": {
        "a_wins": 62,
        "b_wins": 38,
        "avg_turns": 16.4,
        "best_a_win_game_id": 7,
        "median_a_win_game_id": 23,
        "worst_a_win_game_id": 51
      }
    }
  ]
}
```

---

## Web Dashboard

Served by Flask. Single-page app with three views navigated by URL.

### View 1 — Leaderboard (`/`)
- Lists all strategies ranked by overall win rate.
- Columns: rank, name, win rate vs random baseline, overall win rate (bar), avg game length.
- Clicking any row jumps to the Head-to-Head Matrix (View 2) with that strategy highlighted.

### View 2 — Head-to-Head Matrix (`/matrix`)
- Table: strategies on both axes, cells show win rate of the row strategy vs the column strategy.
- Colour-coded: green > 50%, red < 50%, yellow ≈ 50%.
- Click any cell → View 3 for that matchup.

### View 3 — Game Replay (`/matchup/<a>/<b>/<game_id>`)
- Shows a visual hex board rendered in SVG or CSS.
- **Game selector:** Best win / Median win / Worst win buttons (wins only, ranked by turn count, pre-computed in summary).
- **Playback controls:** first, prev, next, last.
- **Move log:** scrollable list of all turns; highlights current turn.

---

## CLI Usage

```bash
# Run a full tournament with all strategies in strategies/configs/
python run.py

# Specify games per matchup
python run.py --games 200

# Start the dashboard (serves most recent result by default)
python run.py --serve

# Serve a specific result file
python run.py --serve --result results/2026-04-20T14:32:00.json
```

---

## Out of Scope

- Automated strategy mutation or genetic search (strategies are hand-authored configs).
- Multi-player (Nonaga is strictly 2-player).
- Saving/loading mid-game state.
- User authentication or multi-user dashboard.
