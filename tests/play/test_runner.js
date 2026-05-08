const results = [];

export function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (err) {
    results.push({ name, ok: false, err: err.message || String(err) });
  }
}

export function assert(cond, msg = "assertion failed") {
  if (!cond) throw new Error(msg);
}

// Compares via JSON.stringify — for plain-object equality, both sides
// must have the same key insertion order. Sort keys first if needed.
export function assertEqual(actual, expected, msg = "") {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${msg}\n  expected: ${e}\n  actual:   ${a}`);
}

export function assertSetEqual(actual, expected, msg = "") {
  const cmp = (a, b) => {
    const sa = JSON.stringify(a), sb = JSON.stringify(b);
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  };
  const a = [...actual].sort(cmp);
  const e = [...expected].sort(cmp);
  assertEqual(a, e, msg);
}

export function report() {
  const passed = results.filter(r => r.ok).length;
  const total = results.length;
  if (typeof document !== "undefined") {
    const root = document.getElementById("results");
    root.innerHTML =
      `<h2>${passed}/${total} passed</h2>` +
      results.map(r =>
        `<div class="${r.ok ? 'ok' : 'fail'}">${r.ok ? '✓' : '✗'} ${r.name}` +
        (r.ok ? '' : `<pre>${r.err}</pre>`) + `</div>`
      ).join("");
  } else {
    for (const r of results) {
      console.log(`${r.ok ? "✓" : "✗"} ${r.name}${r.ok ? "" : " — " + r.err}`);
    }
    console.log(`${passed}/${total} passed`);
    if (passed !== total) process.exit(1);
  }
}
