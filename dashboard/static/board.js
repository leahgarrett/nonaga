// dashboard/static/board.js
let currentMoves = [], currentTurn = 0;

function initialDiscs() {
  const d = [];
  for (let q = -2; q <= 2; q++)
    for (let r = -2; r <= 2; r++)
      if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q+r)) <= 2)
        d.push([q, r]);
  return d;
}

function initialPawns() {
  // Clockwise from right, matches engine/_CORNER_ORDER: red=indices 0,2,4; black=1,3,5
  const corners = [[2,0],[2,-2],[0,-2],[-2,0],[-2,2],[0,2]];
  return {
    red:   [corners[0], corners[2], corners[4]],
    black: [corners[1], corners[3], corners[5]],
  };
}

function replayToTurn(moves, turnIndex) {
  const discs = new Set(initialDiscs().map(d => d.join(",")));
  const pawns = { red: initialPawns().red.map(p=>[...p]), black: initialPawns().black.map(p=>[...p]) };
  for (let i = 0; i < turnIndex && i < moves.length; i++) {
    const m = moves[i];
    const color = (m.pawn_index % 2 === 0) ? "red" : "black";
    const slot = Math.floor(m.pawn_index / 2);
    pawns[color][slot] = [...m.pawn_to];
    discs.delete(m.disc_from.join(","));
    discs.add(m.disc_to.join(","));
  }
  return { discs: [...discs].map(s => s.split(",").map(Number)), pawns };
}

function axialToPixel(q, r, size, cx, cy) {
  return [cx + size * 1.5 * q, cy + size * (Math.sqrt(3)/2 * q + Math.sqrt(3) * r)];
}

function renderBoard(discs, pawns, turn, total) {
  const SIZE = 22, W = 360, H = 340, cx = W/2, cy = H/2;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", W); svg.setAttribute("height", H);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

  for (const [q, r] of discs) {
    const [px, py] = axialToPixel(q, r, SIZE, cx, cy);
    const el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    el.setAttribute("cx", px); el.setAttribute("cy", py);
    el.setAttribute("r", SIZE - 2);
    el.setAttribute("fill", "#e8dfd0"); el.setAttribute("stroke", "#b0a090"); el.setAttribute("stroke-width", "1.5");
    svg.appendChild(el);
  }

  const colors = { red: ["#c0392b","#922b21"], black: ["#2c2c2c","#000"] };
  for (const [color, list] of Object.entries(pawns)) {
    for (const [q, r] of list) {
      const [px, py] = axialToPixel(q, r, SIZE, cx, cy);
      const el = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      el.setAttribute("cx", px); el.setAttribute("cy", py);
      el.setAttribute("r", SIZE * 0.44);
      el.setAttribute("fill", colors[color][0]); el.setAttribute("stroke", colors[color][1]); el.setAttribute("stroke-width", "2");
      svg.appendChild(el);
    }
  }

  document.getElementById("board").replaceChildren(svg);
  document.getElementById("turn-info").textContent =
    turn === 0 ? "Start position" : `Turn ${turn} of ${total}${turn===total?" — game over":""}`;
}

function renderLog(moves, turn) {
  const log = document.getElementById("move-log");
  log.innerHTML = moves.map((m, i) => {
    const cls = i + 1 === turn ? "active" : "";
    return `<div class="${cls}">T${m.turn} ${m.player}: pawn[${m.pawn_index}] [${m.pawn_from}]->[${m.pawn_to}] | disc [${m.disc_from}]->[${m.disc_to}]</div>`;
  }).join("");
  const active = log.querySelector(".active");
  if (active) active.scrollIntoView({ block: "nearest" });
}

function render() {
  const { discs, pawns } = replayToTurn(currentMoves, currentTurn);
  renderBoard(discs, pawns, currentTurn, currentMoves.length);
  renderLog(currentMoves, currentTurn);
}

function goFirst() { currentTurn = 0; render(); }
function goPrev()  { if (currentTurn > 0) { currentTurn--; render(); } }
function goNext()  { if (currentTurn < currentMoves.length) { currentTurn++; render(); } }
function goLast()  { currentTurn = currentMoves.length; render(); }

async function loadGame(gameId, btn) {
  document.querySelectorAll(".gbtn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  const res = await fetch(`/api/game/${SA}/${SB}/${gameId}`);
  const game = await res.json();
  currentMoves = game.moves;
  currentTurn = 0;
  render();
}
