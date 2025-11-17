// src/utils/collisionAvoidance.js
export function checkForConflicts(path1, path2) {
  const set1 = new Set();
  const set2 = new Set();

  // Loại bỏ điểm xuất phát và điểm về kho cuối (cho phép chồng ở start/end)
  for (let i = 1; i < path1.length - 1; i++) {
    // Sửa -1 thay -2 để chính xác hơn
    set1.add(`${path1[i][0]},${path1[i][1]}`);
  }
  for (let i = 1; i < path2.length - 1; i++) {
    set2.add(`${path2[i][0]},${path2[i][1]}`);
  }

  // Kiểm tra giao nhau
  for (const pos of set1) {
    if (set2.has(pos)) return true;
  }
  return false;
}

// Hàm mới: Tính min delay (ở đơn vị steps) để v2 không va chạm v1
export function findMinDelay(path1, path2) {
  let minDelay = 0;
  const maxDelay = Math.min(path1.length, path2.length); // Giới hạn để tránh loop vô tận

  while (minDelay < maxDelay) {
    let conflict = false;
    for (let t = 0; t < path1.length; t++) {
      const v2_t = t - minDelay;
      if (v2_t >= 0 && v2_t < path2.length) {
        const p1 = path1[t];
        const p2 = path2[v2_t];
        if (p1[0] === p2[0] && p1[1] === p2[1]) {
          conflict = true;
          break;
        }
      }
    }
    if (!conflict) {
      return minDelay;
    }
    minDelay++;
  }
  // Nếu không tìm được, delay full để an toàn
  return path1.length;
}
