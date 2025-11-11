// aStar.js
import { isValidPath } from './utils';

function heuristic(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

export function aStarSearch(start, end) {
  const SIZE = ;

  if (!isValidPath(start[0], start[1]) || !isValidPath(end[0], end[1])) {
    return [];
  }

  function Node(pos, parent = null, g = 0, h = 0) {
    this.pos = pos;
    this.parent = parent;
    this.g = g;
    this.h = h;
    this.f = g + h;
  }

  const open = [];
  const closed = new Set();
  open.push(new Node(start, null, 0, heuristic(start, end)));

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f);
    const current = open.shift();
    const key = current.pos.join(',');

    if (closed.has(key)) continue;
    closed.add(key);

    if (current.pos[0] === end[0] && current.pos[1] === end[1]) {
      const path = [];
      let p = current;
      while (p) {
        path.push(p.pos);
        p = p.parent;
      }
      return path.reverse();
    }

    const [r, c] = current.pos;
    const neighbors = [];
    if (r > 0 && isValidPath(r - 1, c)) neighbors.push([r - 1, c]);
    if (r < SIZE - 1 && isValidPath(r + 1, c)) neighbors.push([r + 1, c]);
    if (c > 0 && isValidPath(r, c - 1)) neighbors.push([r, c - 1]);
    if (c < SIZE - 1 && isValidPath(r, c + 1)) neighbors.push([r, c + 1]);

    for (const n of neighbors) {
      if (closed.has(n.join(','))) continue;
      const g = current.g + 1;
      const h = heuristic(n, end);
      const existing = open.find(o => o.pos[0] === n[0] && o.pos[1] === n[1]);
      if (existing) {
        if (g < existing.g) {
          existing.g = g;
          existing.f = g + h;
          existing.parent = current;
        }
      } else {
        open.push(new Node(n, current, g, h));
      }
    }
  }
  return [];
}