# run.py
from __future__ import annotations
import argparse
import sys

CONFIGS_DIR = "strategies/configs"
RESULTS_DIR = "results"


def cmd_run(games: int) -> str:
    from runner.tournament import load_all_strategies, run_tournament
    from runner.recorder import save_results

    print(f"Loading strategies from {CONFIGS_DIR}...")
    strategies = load_all_strategies(CONFIGS_DIR)
    print(f"Strategies: {list(strategies.keys())}")
    print(f"Running tournament ({games} games per matchup)...")

    results = run_tournament(strategies, n_games=games)
    path = save_results(results, RESULTS_DIR)
    print(f"Saved to {path}\n")

    for m in results["matchups"]:
        s = m["summary"]
        print(
            f"  {m['strategy_a']} vs {m['strategy_b']}: "
            f"{s['a_wins']}W / {s['b_wins']}L  "
            f"(avg {s['avg_turns']} turns)"
        )
    return path


def cmd_serve(result_path: str | None, port: int) -> None:
    from runner.recorder import load_results, load_latest_results
    from dashboard.app import create_app

    data = load_results(result_path) if result_path else load_latest_results(RESULTS_DIR)
    if data is None:
        print("No results found. Run a tournament first: python run.py")
        sys.exit(1)

    app = create_app(data)
    print(f"Dashboard at http://localhost:{port}")
    app.run(debug=False, port=port)


def main() -> None:
    parser = argparse.ArgumentParser(description="Nonaga Strategy Lab")
    parser.add_argument("--games", type=int, default=100, help="Games per matchup (default 100)")
    parser.add_argument("--serve", action="store_true", help="Start dashboard instead of running tournament")
    parser.add_argument("--result", type=str, default=None, help="Result JSON to serve (default: latest)")
    parser.add_argument("--port", type=int, default=5000)
    args = parser.parse_args()

    if args.serve:
        cmd_serve(args.result, args.port)
    else:
        cmd_run(args.games)


if __name__ == "__main__":
    main()
