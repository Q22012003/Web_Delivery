// Hàm heuristic (Manhattan distance) - ước tính chi phí từ điểm hiện tại đến điểm cuối
function heuristic(a, b) {
    return Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
  }
  
  // Hàm tìm kiếm A*
  // start và end là các mảng [row, col], ví dụ [0, 0]
  export function aStarSearch(start, end) {
    const gridWidth = 5;
    const gridHeight = 5;
  
    // Node cho A*
    function Node(pos, parent = null, g = 0, h = 0) {
      this.pos = pos;     // [row, col]
      this.parent = parent; // Node cha
      this.g = g;         // Chi phí từ điểm bắt đầu
      this.h = h;         // Chi phí heuristic
      this.f = g + h;     // Tổng chi phí
    }
  
    const openList = [];
    const closedList = new Set();
    const startNode = new Node(start, null, 0, heuristic(start, end));
    openList.push(startNode);
  
    while (openList.length > 0) {
      // Sắp xếp openList để tìm node có F thấp nhất
      openList.sort((a, b) => a.f - b.f);
      const currentNode = openList.shift();
      closedList.add(currentNode.pos.join(','));
  
      // Nếu đến đích
      if (currentNode.pos[0] === end[0] && currentNode.pos[1] === end[1]) {
        const path = [];
        let current = currentNode;
        while (current) {
          path.push(current.pos);
          current = current.parent;
        }
        return path.reverse(); // Đảo ngược để có đường đi từ start -> end
      }
  
      // Lấy các hàng xóm (trên, dưới, trái, phải)
      const neighbors = [];
      const [r, c] = currentNode.pos;
      if (r > 0) neighbors.push([r - 1, c]);
      if (r < gridHeight - 1) neighbors.push([r + 1, c]);
      if (c > 0) neighbors.push([r, c - 1]);
      if (c < gridWidth - 1) neighbors.push([r, c + 1]);
  
      for (const neighborPos of neighbors) {
        if (closedList.has(neighborPos.join(','))) {
          continue;
        }
  
        const gScore = currentNode.g + 1; // Chi phí mỗi bước là 1
        const hScore = heuristic(neighborPos, end);
        const fScore = gScore + hScore;
  
        // Kiểm tra xem node hàng xóm đã có trong openList chưa
        let existingNode = openList.find(node => node.pos[0] === neighborPos[0] && node.pos[1] === neighborPos[1]);
  
        if (existingNode) {
          if (gScore < existingNode.g) {
            // Tìm thấy đường đi tốt hơn
            existingNode.g = gScore;
            existingNode.f = fScore;
            existingNode.parent = currentNode;
          }
        } else {
          // Thêm node mới
          openList.push(new Node(neighborPos, currentNode, gScore, hScore));
        }
      }
    }
  
    return []; // Không tìm thấy đường đi
  }