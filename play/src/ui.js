import { initialState, applyMove, checkWin, legalMoves } from "./engine.js";
import { loadStrategy, pickMove } from "./strategies.js";
import { GameTree } from "./game-tree.js";

const SIZE = 22, W = 360, H = 340;
const SVG_NS = "http://www.w3.org/2000/svg";

function axialToPixel(q, r) {
  return [W/2 + SIZE * 1.5 * q,
          H/2 + SIZE * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r)];
}

let tree = null;
let strategyConfig = null;
let humanColor = "red";

async function newGame() {
  strategyConfig = await loadStrategy(document.getElementById("strategy").value);
  const colorChoice = document.getElementById("color").value;
  humanColor = colorChoice === "random" ? (Math.random() < 0.5 ? "red" : "black") : colorChoice;
  tree = new GameTree(initialState("red"));
  render();
  await maybeAITurn();
}

function render() {
  const s = tree.current.state;
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", W);
  svg.setAttribute("height", H);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  for (const k of s.discs) {
    const [q, r] = k.split(",").map(Number);
    const [px, py] = axialToPixel(q, r);
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("cx", px); c.setAttribute("cy", py);
    c.setAttribute("r", SIZE - 2);
    c.classList.add("disc");
    if (s.lastPlacedDisc && k === `${s.lastPlacedDisc[0]},${s.lastPlacedDisc[1]}`) {
      c.classList.add("last-placed");
    }
    svg.appendChild(c);
  }

  for (const [color, list] of [["red", s.redPawns], ["black", s.blackPawns]]) {
    for (const [q, r] of list) {
      const [px, py] = axialToPixel(q, r);
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", px); c.setAttribute("cy", py);
      c.setAttribute("r", SIZE * 0.44);
      c.classList.add("pawn", `pawn-${color}`);
      svg.appendChild(c);
    }
  }
  document.getElementById("board").replaceChildren(svg);

  const w = checkWin(s);
  const status = document.getElementById("status");
  if (w) {
    status.textContent = w === humanColor ? "You won!" : `${strategyConfig.name} won.`;
  } else if (s.currentPlayer === humanColor) {
    status.textContent = "Your turn — pick a pawn.";
  } else {
    status.textContent = "AI thinking…";
  }

  renderLog();
}

function renderLog() {
  const nodes = tree.mainlineFromRoot();
  const log = document.getElementById("move-log");
  log.innerHTML = nodes.slice(1).map((n, i) => {
    const m = n.move;
    const cls = n === tree.current ? "active" : "";
    return `<div class="${cls}">T${i+1} ${n.parent.state.currentPlayer}: ` +
           `pawn[${m.pawnIndex}] [${m.pawnFrom}]→[${m.pawnTo}] | ` +
           `disc [${m.discFrom}]→[${m.discTo}]</div>`;
  }).join("");
}

async function maybeAITurn() {
  while (tree.current.state.currentPlayer !== humanColor && !checkWin(tree.current.state)) {
    if (legalMoves(tree.current.state).length === 0) break;
    await new Promise(r => setTimeout(r, 200));
    const m = pickMove(tree.current.state, strategyConfig);
    tree.playMove(m, applyMove);
    render();
  }
}

// Scrubber wiring
document.getElementById("btn-first").onclick = () => { tree?.first(); render(); };
document.getElementById("btn-prev").onclick  = () => { tree?.prev();  render(); };
document.getElementById("btn-next").onclick  = () => { tree?.next();  render(); };
document.getElementById("btn-last").onclick  = () => { tree?.last();  render(); };

document.getElementById("new-game").onclick = newGame;
