import CarIcon from './CarIcon';

export default function Vehicle({ id, pos, status, nextPos }) {
  const cellSize = 200;
  const x = pos[1] * cellSize;
  const y = (4 - pos[0]) * cellSize;

  let direction = 'down';
  if (nextPos) {
    const dx = nextPos[1] - pos[1];
    const dy = nextPos[0] - pos[0];
    if (dx === 1) direction = 'right';
    else if (dx === -1) direction = 'left';
    else if (dy === 1) direction = 'down';
    else if (dy === -1) direction = 'up';
  }

  const color = id === 'V1' ? '#FF5722' : '#4CAF50';
  const idleColor = '#999';

  return (
    <div
      style={{
        position: 'absolute',
        left: x - 40,
        top: y - 55,
        width: 80,
        height: 110,
        transition: 'all 0.8s ease-in-out',
        zIndex: 20,
        pointerEvents: 'none',
      }}
    >
      <CarIcon color={status === 'idle' ? idleColor : color} direction={direction} />
      <div style={{
        textAlign: 'center',
        marginTop: 4,
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
        textShadow: '0 0 8px rgba(0,0,0,0.8)',
      }}>
        {id}
      </div>
    </div>
  );
}