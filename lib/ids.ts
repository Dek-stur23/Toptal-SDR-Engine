// Monotonic, collision-free id generator for hotlist prospects/messages.
//
// Why not just Date.now() + random? Date.now() returns whole milliseconds, so
// two synchronous calls in the same tick collide. random() narrows the window
// but doesn't eliminate it; under tight loops (bulk-add, dedup pass) it can
// and did fail.
//
// This generator guarantees strict monotonicity: every call returns a value
// strictly larger than the previous one, even within the same millisecond.
// We scale Date.now() by 1000 so a counter can advance under it without
// overrunning the next millisecond. With Date.now() ~ 1.7e12, the scaled
// value sits ~1.7e15 — still well under Number.MAX_SAFE_INTEGER (~9.0e15),
// so we have multi-century headroom.

let _last = 0;

export function genId(): number {
  const now = Date.now() * 1000;
  _last = now > _last ? now : _last + 1;
  return _last;
}
