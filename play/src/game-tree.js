export class GameTree {
  constructor(initial) {
    this.root = {
      state: initial, move: null, parent: null,
      children: [], mainline: null,
    };
    this.current = this.root;
  }

  playMove(move, applyFn) {
    const next = {
      state: applyFn(this.current.state, move),
      move,
      parent: this.current,
      children: [],
      mainline: null,
    };
    this.current.children.push(next);
    // replace mainline pointer; old branch stays reachable in children[]
    this.current.mainline = next;
    this.current = next;
    return next;
  }

  first() { this.current = this.root; }
  prev()  { if (this.current.parent) this.current = this.current.parent; }
  next()  { if (this.current.mainline) this.current = this.current.mainline; }
  last()  { while (this.current.mainline) this.current = this.current.mainline; }

  mainlineFromRoot() {
    const out = [this.root];
    let n = this.root;
    while (n.mainline) { n = n.mainline; out.push(n); }
    return out;
  }
}
