import { report } from "./test_runner.js";
await import("./test_engine.js");
await import("./test_strategies.js");
await import("./test_game_tree.js");
report();
