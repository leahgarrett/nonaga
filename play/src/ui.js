import {
  initialState, applyMove, checkWin, legalMoves,
  key, pawnDestinations, removableDiscs, validPlacements,
} from "./engine.js";
import { loadStrategy, pickMove } from "./strategies.js";
import { GameTree } from "./game-tree.js";

const SIZE = 22, W = 360, H = 340;
const SVG_NS = "http://www.w3.org/2000/svg";

let staging = null; // { phase, pawnIndex, pawnFrom?, pawnTo?, discFrom?, discTo? }

function resetStaging() { staging = null; }

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
  const isHumanTurn = s.currentPlayer === humanColor && !checkWin(s);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  // Compute staging artefacts
  const stagedDiscFromKey = staging?.discFrom ? key(staging.discFrom) : null;
  const stagedDiscToKey   = staging?.discTo   ? key(staging.discTo)   : null;

  // Discs
  for (const k of s.discs) {
    if (k === stagedDiscFromKey) continue; // hide removed disc
    const [q, r] = k.split(",").map(Number);
    drawDisc(svg, q, r, k, s);
  }
  // Ghost placement
  if (stagedDiscToKey) {
    const [q, r] = staging.discTo;
    const c = drawDisc(svg, q, r, stagedDiscToKey, s);
    c.classList.add("placement");
  }

  // Pawn slide-destination highlights
  if (staging?.phase === "pawn-selected") {
    const dests = pawnDestinations(s, staging.pawnFrom);
    for (const [q, r] of dests) {
      const [px, py] = axialToPixel(q, r);
      const d = document.createElementNS(SVG_NS, "circle");
      d.setAttribute("cx", px); d.setAttribute("cy", py); d.setAttribute("r", SIZE - 4);
      d.classList.add("dest");
      d.onclick = () => { stagePawnTo([q, r]); };
      svg.appendChild(d);
    }
  }

  // Removable-disc highlights
  if (staging?.phase === "pawn-staged") {
    const occupied = occupiedAfterPawnStage(s);
    const rem = removableDiscs(s.discs, occupied);
    rem.delete(s.lastPlacedDisc ? key(s.lastPlacedDisc) : "");
    for (const k of rem) {
      const c = svg.querySelector(`[data-key="${k}"]`);
      if (c) {
        c.classList.add("removable");
        c.onclick = () => { stageDiscFrom(k.split(",").map(Number)); };
      }
    }
  }

  // Placement highlights
  if (staging?.phase === "disc-staged") {
    const after = new Set(s.discs); after.delete(key(staging.discFrom));
    const places = validPlacements(after, staging.discFrom);
    for (const k of places) {
      const [q, r] = k.split(",").map(Number);
      const [px, py] = axialToPixel(q, r);
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", px); c.setAttribute("cy", py); c.setAttribute("r", SIZE - 4);
      c.classList.add("disc", "placement");
      c.onclick = () => { stageDiscTo([q, r]); };
      svg.appendChild(c);
    }
  }

  // Pawns (skip the moving pawn if its post-stage position differs)
  drawPawns(svg, s, staging);

  document.getElementById("board").replaceChildren(svg);

  // Confirm/cancel buttons
  const confirmRow = ensureConfirmRow();
  confirmRow.style.display = staging?.phase === "confirm" ? "flex" : "none";

  // Status & log
  setStatus(s, isHumanTurn);
  renderLog();
}

function drawDisc(svg, q, r, k, state) {
  const [px, py] = axialToPixel(q, r);
  const c = document.createElementNS(SVG_NS, "circle");
  c.setAttribute("cx", px); c.setAttribute("cy", py);
  c.setAttribute("r", SIZE - 2);
  c.classList.add("disc");
  c.dataset.key = k;
  if (state.lastPlacedDisc && k === key(state.lastPlacedDisc)) c.classList.add("last-placed");
  svg.appendChild(c);
  return c;
}

function drawPawns(svg, state, staging) {
  for (const [color, list] of [["red", state.redPawns], ["black", state.blackPawns]]) {
    list.forEach((pos, idx) => {
      const isMover = staging && color === state.currentPlayer && idx === staging.pawnIndex;
      const drawAt = isMover && staging.pawnTo ? staging.pawnTo : pos;
      const [px, py] = axialToPixel(drawAt[0], drawAt[1]);
      const c = document.createElementNS(SVG_NS, "circle");
      c.setAttribute("cx", px); c.setAttribute("cy", py);
      c.setAttribute("r", SIZE * 0.44);
      c.classList.add("pawn", `pawn-${color}`);
      if (isMover && staging.pawnTo) c.classList.add("ghost");
      if (color === humanColor && state.currentPlayer === humanColor && !checkWin(state)) {
        c.classList.add("selectable");
        c.onclick = () => selectPawn(idx, pos);
        if (staging?.phase === "pawn-selected" && staging.pawnIndex === idx) c.classList.add("selected");
      }
      svg.appendChild(c);
    });
  }
}

function occupiedAfterPawnStage(state) {
  const all = new Set([...state.redPawns.map(key), ...state.blackPawns.map(key)]);
  all.delete(key(staging.pawnFrom));
  all.add(key(staging.pawnTo));
  return all;
}

function selectPawn(idx, pos) {
  staging = { phase: "pawn-selected", pawnIndex: idx, pawnFrom: pos };
  render();
}
function stagePawnTo(to) {
  staging = { ...staging, phase: "pawn-staged", pawnTo: to };
  render();
}
function stageDiscFrom(from) {
  staging = { ...staging, phase: "disc-staged", discFrom: from };
  render();
}
function stageDiscTo(to) {
  staging = { ...staging, phase: "confirm", discTo: to };
  render();
}

function ensureConfirmRow() {
  let row = document.getElementById("confirm-row");
  if (!row) {
    row = document.createElement("div");
    row.id = "confirm-row";
    row.style.cssText = "display:none;gap:.5rem;margin-top:.5rem;";
    row.innerHTML = `<button id="btn-confirm">Confirm turn</button>
                     <button id="btn-cancel">Cancel</button>`;
    document.querySelector(".scrubber").after(row);
    document.getElementById("btn-confirm").onclick = confirmTurn;
    document.getElementById("btn-cancel").onclick = () => { resetStaging(); render(); };
  }
  return row;
}

async function confirmTurn() {
  const move = {
    pawnIndex: staging.pawnIndex,
    pawnFrom: staging.pawnFrom, pawnTo: staging.pawnTo,
    discFrom: staging.discFrom, discTo: staging.discTo,
  };
  resetStaging();
  tree.playMove(move, applyMove);
  render();
  await maybeAITurn();
}

function setStatus(s, isHumanTurn) {
  const status = document.getElementById("status");
  const w = checkWin(s);
  if (w) {
    status.innerHTML = `<span class="banner ${w === humanColor ? "" : "lose"}">${
      w === humanColor ? "You won!" : strategyConfig.name + " won."
    }</span>`;
    return;
  }
  if (!isHumanTurn) { status.textContent = "AI thinking…"; return; }
  status.textContent = ({
    "pawn-selected": "Choose a destination for your pawn.",
    "pawn-staged":   "Pick a free edge disc to remove.",
    "disc-staged":   "Pick where to place the disc.",
    "confirm":       "Confirm or cancel your turn.",
  }[staging?.phase] ?? "Your turn — pick a pawn.");
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
const onScrub = (fn) => () => { if (!tree) return; resetStaging(); fn(); render(); };
document.getElementById("btn-first").onclick = onScrub(() => tree.first());
document.getElementById("btn-prev").onclick  = onScrub(() => tree.prev());
document.getElementById("btn-next").onclick  = onScrub(() => tree.next());
document.getElementById("btn-last").onclick  = onScrub(() => tree.last());

document.getElementById("new-game").onclick = newGame;
