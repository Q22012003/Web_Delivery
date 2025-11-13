
const SIZE = 6; // 6x6: row 0-5, col 0-5

// ĐƯỜNG ĐI HỢP LỆ: hàng 1 + cột 5 + hàng 5 (đường ngang trên + dọc phải + ngang dưới)
const isValidPath = (r, c) => {
  return r === 1 || c === 5 || r === 5;
};

function heuristic(a, b) {
  return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
}

export function aStarSearch(start, end, returnToStart = true) {
  if (!isValidPath(start[0], start[1]) || !isValidPath(end[0], end[1])) {
    return [];
  }

  class Node {
    constructor(pos, parent = null, g = 0, h = 0) {
      this.pos = pos;
      this.parent = parent;
      this.g = g;
      this.h = h;
      this.f = g + h;
    }
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
      const fullPath = path.reverse();

      if (returnToStart) {
        const returnPath = aStarSearch(end, start, false);
        return returnPath.length > 0 ? fullPath.concat(returnPath.slice(1)) : fullPath;
      }
      return fullPath;
    }

    const [r, c] = current.pos;
    const neighbors = [];
    if (r > 0 && isValidPath(r - 1, c)) neighbors.push([r - 1, c]);
    if (r < SIZE - 1 && isValidPath(r + 1, c)) neighbors.push([r + 1, c]);
    if (c > 0 && isValidPath(r, c - 1)) neighbors.push([r, c - 1]);
    if (c < SIZE - 1 && isValidPath(r, c + 1)) neighbors.push([r, c + 1]);

    for (const n of neighbors) {
      const nKey = n.join(',');
      if (closed.has(nKey)) continue;

      const g = current.g + 1;
      const h = heuristic(n, end);
      const existing = open.find(o => o.pos.join(',') === nKey);

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