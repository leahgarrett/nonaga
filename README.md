# Nonaga Strategy Lab

A self-play harness for the board game [Nonaga](https://ilo307.ca/Public/img/catalog/Nonaga_Rules_EN.pdf). Strategies are defined as JSON config files. A tournament runner pits every strategy against every other (and a random baseline) for 100 games per matchup. Results are stored as JSON and explored via a Flask web dashboard.

## Requirements

- Python 3.9+
- Flask (`pip3 install flask`)

## Setup

```bash
pip3 install -r requirements.txt
```

## Run a tournament

```bash
python3 run.py
```

Options:

```bash
python3 run.py --games 200          # change games per matchup (default: 100)
```

Output is saved to `results/` as a timestamped JSON file.

## Start the dashboard

```bash
python3 run.py --serve              # serves the most recent result
python3 run.py --serve --result results/2026-04-22T21-44-16.json  # serve a specific file
python3 run.py --serve --port 8080  # custom port (default: 5000)
```

Then open http://localhost:5000 in your browser.

**Views:**
- `/` — strategy leaderboard with win rates and avg game length
- `/matrix` — head-to-head win rate matrix (click a cell to replay)
- `/matchup/<a>/<b>` — step-through game replay with best/median/worst win selector

## Play in the browser

A static play page is available at `play/index.html`. To play locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/play/
```

Or via the Flask dashboard at `http://localhost:5000/play/`.

The page is fully static — drop the repo onto GitHub Pages and `play/index.html` works as-is.

## Add a strategy

Drop a JSON file in `strategies/configs/`:

```json
{
  "name": "My Strategy",
  "description": "What it does",
  "heuristics": {
    "cluster_own":    0.8,
    "block_opponent": 0.3,
    "prefer_center":  0.5,
    "disc_help_self": 0.6,
    "disc_hurt_opp":  0.2,
    "randomness":     0.05
  }
}
```

All weights are floats between 0.0 and 1.0. Run the tournament again to include it.

## Run the tests

```bash
python3 -m pytest tests/
python3 -m pytest tests/ -v         # verbose
python3 -m pytest tests/engine/     # engine only
```

## Project structure

```
engine/          # Game rules — board, moves, win detection
strategies/      # Strategy engine + JSON config files
runner/          # Tournament runner and JSON recorder
dashboard/       # Flask app, templates, SVG board renderer
tests/           # Test suite (75 tests)
run.py           # CLI entry point
results/         # Tournament output (gitignored)
```
