(function(){
  const canvas = document.getElementById('game');
  if (!canvas) return;
  const c = canvas.getContext('2d');

  function resize() {
    const ratio = 960 / 540;
    const w = Math.min(canvas.parentElement.clientWidth, 960);
    const h = Math.round(w / ratio);
    canvas.width = 960;
    canvas.height = 540;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
  }
  window.addEventListener('resize', resize);
  resize();

  const W = () => canvas.width, H = () => canvas.height;
  let running = true, paused = false;
  let playerScore = 0, aiScore = 0;
  let highScore = parseInt(localStorage.getItem('carrommeta_high') || '999', 10);
  let gameTime = 0;
  let shots = 0;
  let gameOver = false;

  const boardMargin = 50;
  const boardSize = H() - 2 * boardMargin;
  const boardX = (W() - boardSize) / 2;
  const boardY = boardMargin;

  const pocketRadius = 25;
  const pockets = [
    { x: boardX + pocketRadius, y: boardY + pocketRadius },
    { x: boardX + boardSize - pocketRadius, y: boardY + pocketRadius },
    { x: boardX + pocketRadius, y: boardY + boardSize - pocketRadius },
    { x: boardX + boardSize - pocketRadius, y: boardY + boardSize - pocketRadius },
  ];

  const striker = {
    x: W() / 2,
    y: boardY + boardSize - 70,
    radius: 18,
    color: '#3B82F6',
    vx: 0,
    vy: 0,
    isShooting: false,
    isMoving: false,
  };

  let coins = [];
  const coinRadius = 15;

  const mouse = { x: 0, y: 0, isDown: false };

  function setupCoins() {
    coins = [];
    const center = { x: W() / 2, y: H() / 2 };
    // Queen
    coins.push({ x: center.x, y: center.y, radius: coinRadius, color: '#e4340c', vx: 0, vy: 0, active: true });
    // Surrounding coins
    for (let i = 0; i < 2; i++) {
      for (let j = 0; j < 6; j++) {
        const angle = (j / 6) * 2 * Math.PI;
        const dist = coinRadius * 2.2 * (i + 1);
        coins.push({
          x: center.x + dist * Math.cos(angle),
          y: center.y + dist * Math.sin(angle),
          radius: coinRadius,
          color: i % 2 === 0 ? '#222' : '#f0d9b5',
          vx: 0,
          vy: 0,
          active: true
        });
      }
    }
  }

  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  });

  canvas.addEventListener('mousedown', () => { mouse.isDown = true; });
  canvas.addEventListener('mouseup', () => {
    if (!striker.isMoving && !striker.isShooting) {
      striker.isShooting = true;
      const dx = mouse.x - striker.x;
      const dy = mouse.y - striker.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const power = Math.min(dist / 10, 20);
      striker.vx = -dx / dist * power;
      striker.vy = -dy / dist * power;
      striker.isMoving = true;
      shots++;
    }
    mouse.isDown = false;
  });

  window.addEventListener('keydown', e => {
    if (e.key === 'p' || e.key === 'P') paused = !paused;
    if (e.key === 'r' || e.key === 'R') restart();
  });

  function updatePhysics() {
    const allDiscs = [striker, ...coins.filter(coin => coin.active)];
    let isMoving = false;

    allDiscs.forEach(disc => {
      disc.vx *= 0.98; // Friction
      disc.vy *= 0.98;

      if (Math.abs(disc.vx) < 0.1) disc.vx = 0;
      if (Math.abs(disc.vy) < 0.1) disc.vy = 0;

      if (disc.vx !== 0 || disc.vy !== 0) isMoving = true;

      disc.x += disc.vx;
      disc.y += disc.vy;

      // Wall collisions
      if (disc.x - disc.radius < boardX) { disc.x = boardX + disc.radius; disc.vx *= -0.8; }
      if (disc.x + disc.radius > boardX + boardSize) { disc.x = boardX + boardSize - disc.radius; disc.vx *= -0.8; }
      if (disc.y - disc.radius < boardY) { disc.y = boardY + disc.radius; disc.vy *= -0.8; }
      if (disc.y + disc.radius > boardY + boardSize) { disc.y = boardY + boardSize - disc.radius; disc.vy *= -0.8; }

      // Pocket collisions
      pockets.forEach(pocket => {
        const dx = disc.x - pocket.x;
        const dy = disc.y - pocket.y;
        if (Math.sqrt(dx * dx + dy * dy) < pocketRadius) {
          if (disc === striker) {
            resetStriker();
          } else {
            disc.active = false;
          }
        }
      });
    });

    // Disc-disc collisions
    for (let i = 0; i < allDiscs.length; i++) {
      for (let j = i + 1; j < allDiscs.length; j++) {
        const d1 = allDiscs[i];
        const d2 = allDiscs[j];
        const dx = d2.x - d1.x;
        const dy = d2.y - d1.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < d1.radius + d2.radius) {
          // Simple elastic collision
          const angle = Math.atan2(dy, dx);
          const sin = Math.sin(angle);
          const cos = Math.cos(angle);

          const vx1 = d1.vx * cos + d1.vy * sin;
          const vy1 = d1.vy * cos - d1.vx * sin;
          const vx2 = d2.vx * cos + d2.vy * sin;
          const vy2 = d2.vy * cos - d2.vx * sin;

          const vx1Final = ((d1.radius - d2.radius) * vx1 + 2 * d2.radius * vx2) / (d1.radius + d2.radius);
          const vx2Final = ((d2.radius - d1.radius) * vx2 + 2 * d1.radius * vx1) / (d1.radius + d2.radius);

          d1.vx = vx1Final * cos - vy1 * sin;
          d1.vy = vy1 * cos + vx1Final * sin;
          d2.vx = vx2Final * cos - vy2 * sin;
          d2.vy = vy2 * cos + vx2Final * sin;
        }
      }
    }

    if (!isMoving && striker.isShooting) {
      striker.isShooting = false;
      striker.isMoving = false;
      resetStriker();
    }
  }

  function resetStriker() {
    striker.x = W() / 2;
    striker.y = boardY + boardSize - 70;
    striker.vx = 0;
    striker.vy = 0;
    striker.isMoving = false;
  }

  function drawBoard() {
    c.fillStyle = '#c7a17a'; // Wood color
    c.fillRect(boardX, boardY, boardSize, boardSize);
    c.strokeStyle = '#312e2b';
    c.lineWidth = 4;
    c.strokeRect(boardX, boardY, boardSize, boardSize);

    pockets.forEach(p => {
      c.fillStyle = '#000';
      c.beginPath();
      c.arc(p.x, p.y, pocketRadius, 0, 2 * Math.PI);
      c.fill();
    });

    c.beginPath();
    c.arc(W() / 2, H() / 2, 60, 0, 2 * Math.PI);
    c.stroke();
  }

  function drawDiscs() {
    coins.forEach(coin => {
      if (coin.active) {
        c.fillStyle = coin.color;
        c.beginPath();
        c.arc(coin.x, coin.y, coin.radius, 0, 2 * Math.PI);
        c.fill();
        c.strokeStyle = '#555';
        c.stroke();
      }
    });

    c.fillStyle = striker.color;
    c.beginPath();
    c.arc(striker.x, striker.y, striker.radius, 0, 2 * Math.PI);
    c.fill();
    c.strokeStyle = '#fff';
    c.stroke();

    if (mouse.isDown && !striker.isMoving) {
      c.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(striker.x, striker.y);
      c.lineTo(mouse.x, mouse.y);
      c.stroke();
    }
  }

  // Draw HUD
  function drawHUD() {
    c.fillStyle = 'rgba(255, 255, 255, 0.92)';
    c.font = '20px Inter, Arial';
    c.fillText(`Shots: ${shots}`, 20, 30);
    c.fillText(`Best: ${highScore === 999 ? '-' : highScore}`, W() - 100, 30);
    
    if (paused) {
      c.textAlign = 'center';
      c.font = '30px Inter, Arial';
      c.fillText('PAUSED', W() / 2, H() / 2);
      c.textAlign = 'left';
    }
    
    if (gameOver) {
      c.textAlign = 'center';
      c.font = '30px Inter, Arial';
      c.fillText('YOU WIN!', W() / 2, H() / 2 - 30);
      c.font = '20px Inter, Arial';
      c.fillText(`Final Score: ${shots}. Press R to play again.`, W() / 2, H() / 2 + 10);
      c.textAlign = 'left';
    }
  }

  // Game loop
  function loop() {
    if (!running || paused) {
      requestAnimationFrame(loop);
      return;
    }
    
    if (!striker.isMoving && !striker.isShooting) {
      striker.x = mouse.x;
      striker.x = Math.max(boardX + striker.radius, Math.min(boardX + boardSize - striker.radius, striker.x));
    }

    updatePhysics();
    
    // Draw everything
    c.clearRect(0, 0, W(), H());
    drawBoard();
    drawDiscs();
    drawHUD();
    
    if (coins.every(coin => !coin.active) && !gameOver) {
      gameOver = true;
      running = false;
      highScore = Math.min(highScore, shots);
      localStorage.setItem('carrommeta_high', String(highScore));
      const lb = JSON.parse(localStorage.getItem('carrommeta_leaderboard') || '[]');
      lb.push({ score: shots, at: new Date().toISOString() });
      lb.sort((a, b) => a.score - b.score);
      localStorage.setItem('carrommeta_leaderboard', JSON.stringify(lb.slice(0, 50)));
    }

    requestAnimationFrame(loop);
  }
  
  setupCoins();
  requestAnimationFrame(loop);

  // Restart function
  function restart() {
    running = true;
    paused = false;
    gameOver = false;
    shots = 0;
    setupCoins();
    resetStriker();
  }

  // Button event listeners
  document.getElementById('btn-pause')?.addEventListener('click', () => { 
    paused = !paused; 
  });
  
  document.getElementById('btn-restart')?.addEventListener('click', restart);
})();