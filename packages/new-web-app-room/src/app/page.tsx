'use client';

import { useEffect, useRef, useState } from 'react';

type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';
type Position = { x: number; y: number };
type PowerUp = { x: number; y: number; type: 'speed' | 'freeze' | 'invincible' };
type GhostMode = 'chase' | 'scatter' | 'frightened';
type GhostAI = 'chaser' | 'ambusher' | 'random' | 'patrol';

const GRID_SIZE = 20;
const CELL_SIZE = 20;
const INITIAL_SPEED = 150;
const POWER_PELLET_POSITIONS = [
  { x: 2, y: 2 },
  { x: 17, y: 2 },
  { x: 2, y: 17 },
  { x: 17, y: 17 }
];

export default function PacManGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [level, setLevel] = useState(1);
  const [lives, setLives] = useState(3);
  const [combo, setCombo] = useState(0);
  const [powerUpActive, setPowerUpActive] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  const pacmanRef = useRef<Position>({ x: 10, y: 10 });
  const directionRef = useRef<Direction>('RIGHT');
  const nextDirectionRef = useRef<Direction>('RIGHT');
  const dotsRef = useRef<boolean[][]>([]);
  const powerPelletsRef = useRef<boolean[]>([true, true, true, true]);
  const powerUpRef = useRef<PowerUp | null>(null);
  const ghostsRef = useRef<Array<Position & { mode: GhostMode; ai: GhostAI; target?: Position }>>([
    { x: 5, y: 5, mode: 'chase', ai: 'chaser' },
    { x: 15, y: 5, mode: 'chase', ai: 'ambusher' },
    { x: 5, y: 15, mode: 'chase', ai: 'random' },
    { x: 15, y: 15, mode: 'chase', ai: 'patrol', target: { x: 15, y: 15 } }
  ]);
  const speedRef = useRef(INITIAL_SPEED);
  const invincibleRef = useRef(false);
  const freezeGhostsRef = useRef(false);
  const frightenedTimeRef = useRef(0);
  const powerUpTimeRef = useRef(0);
  const animationFrameRef = useRef(0);
  const particlesRef = useRef<Array<{x: number, y: number, vx: number, vy: number, life: number, color: string}>>([]);

  // Load high score from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pacman-highscore');
    if (saved) setHighScore(parseInt(saved));
  }, []);

  // Save high score
  useEffect(() => {
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('pacman-highscore', score.toString());
    }
  }, [score, highScore]);

  // Initialize dots
  useEffect(() => {
    const dots: boolean[][] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      dots[y] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        // Don't place dots on power pellet positions
        const isPowerPellet = POWER_PELLET_POSITIONS.some(p => p.x === x && p.y === y);
        dots[y][x] = !isPowerPellet;
      }
    }
    dotsRef.current = dots;
  }, []);

  // Spawn random power-ups
  useEffect(() => {
    if (!gameStarted || gameOver) return;
    
    const spawnPowerUp = () => {
      if (Math.random() < 0.3 && !powerUpRef.current) {
        const types: Array<'speed' | 'freeze' | 'invincible'> = ['speed', 'freeze', 'invincible'];
        powerUpRef.current = {
          x: Math.floor(Math.random() * GRID_SIZE),
          y: Math.floor(Math.random() * GRID_SIZE),
          type: types[Math.floor(Math.random() * types.length)]
        };
      }
    };

    const interval = setInterval(spawnPowerUp, 10000);
    return () => clearInterval(interval);
  }, [gameStarted, gameOver]);

  // Play sound effect
  const playSound = (frequency: number, duration: number) => {
    if (!soundEnabled) return;
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = frequency;
      oscillator.type = 'square';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + duration);
    } catch (e) {
      // Silently fail if audio context not available
    }
  };

  // Handle keyboard input
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!gameStarted && !gameOver) {
        setGameStarted(true);
      }
      
      switch (e.key) {
        case 'ArrowUp':
        case 'w':
          nextDirectionRef.current = 'UP';
          break;
        case 'ArrowDown':
        case 's':
          nextDirectionRef.current = 'DOWN';
          break;
        case 'ArrowLeft':
        case 'a':
          nextDirectionRef.current = 'LEFT';
          break;
        case 'ArrowRight':
        case 'd':
          nextDirectionRef.current = 'RIGHT';
          break;
        case 'r':
          if (gameOver) {
            resetGame();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [gameStarted, gameOver]);

  const resetGame = () => {
    pacmanRef.current = { x: 10, y: 10 };
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';
    ghostsRef.current = [
      { x: 5, y: 5, mode: 'chase', ai: 'chaser' },
      { x: 15, y: 5, mode: 'chase', ai: 'ambusher' },
      { x: 5, y: 15, mode: 'chase', ai: 'random' },
      { x: 15, y: 15, mode: 'chase', ai: 'patrol', target: { x: 15, y: 15 } }
    ];
    const dots: boolean[][] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      dots[y] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        const isPowerPellet = POWER_PELLET_POSITIONS.some(p => p.x === x && p.y === y);
        dots[y][x] = !isPowerPellet;
      }
    }
    dotsRef.current = dots;
    powerPelletsRef.current = [true, true, true, true];
    powerUpRef.current = null;
    speedRef.current = INITIAL_SPEED;
    invincibleRef.current = false;
    freezeGhostsRef.current = false;
    frightenedTimeRef.current = 0;
    powerUpTimeRef.current = 0;
    setScore(0);
    setLevel(1);
    setLives(3);
    setCombo(0);
    setPowerUpActive(null);
    setGameOver(false);
    setGameStarted(false);
  };

  const nextLevel = () => {
    pacmanRef.current = { x: 10, y: 10 };
    directionRef.current = 'RIGHT';
    nextDirectionRef.current = 'RIGHT';
    ghostsRef.current = [
      { x: 5, y: 5, mode: 'chase', ai: 'chaser' },
      { x: 15, y: 5, mode: 'chase', ai: 'ambusher' },
      { x: 5, y: 15, mode: 'chase', ai: 'random' },
      { x: 15, y: 15, mode: 'chase', ai: 'patrol', target: { x: 15, y: 15 } }
    ];
    const dots: boolean[][] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      dots[y] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        const isPowerPellet = POWER_PELLET_POSITIONS.some(p => p.x === x && p.y === y);
        dots[y][x] = !isPowerPellet;
      }
    }
    dotsRef.current = dots;
    powerPelletsRef.current = [true, true, true, true];
    powerUpRef.current = null;
    speedRef.current = Math.max(50, INITIAL_SPEED - level * 10);
    invincibleRef.current = false;
    freezeGhostsRef.current = false;
    frightenedTimeRef.current = 0;
    powerUpTimeRef.current = 0;
    setPowerUpActive(null);
    setLevel(l => l + 1);
    setCombo(0);
  };

  const loseLife = () => {
    if (invincibleRef.current) return;
    
    playSound(200, 0.3);
    const newLives = lives - 1;
    setLives(newLives);
    
    if (newLives <= 0) {
      setGameOver(true);
    } else {
      // Reset positions but keep score and level
      pacmanRef.current = { x: 10, y: 10 };
      directionRef.current = 'RIGHT';
      nextDirectionRef.current = 'RIGHT';
      ghostsRef.current = [
        { x: 5, y: 5, mode: 'chase', ai: 'chaser' },
        { x: 15, y: 5, mode: 'chase', ai: 'ambusher' },
        { x: 5, y: 15, mode: 'chase', ai: 'random' },
        { x: 15, y: 15, mode: 'chase', ai: 'patrol', target: { x: 15, y: 15 } }
      ];
      invincibleRef.current = false;
      freezeGhostsRef.current = false;
      frightenedTimeRef.current = 0;
      powerUpTimeRef.current = 0;
      setPowerUpActive(null);
    }
  };

  // AI movement for ghosts
  const moveGhost = (ghost: typeof ghostsRef.current[0]) => {
    if (freezeGhostsRef.current) return ghost;

    const pacman = pacmanRef.current;
    let targetPos = pacman;

    // Different AI behaviors
    if (ghost.mode === 'frightened') {
      // Run away from Pac-Man
      const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
      const randomDir = directions[Math.floor(Math.random() * directions.length)];
      const newGhost = { ...ghost };
      
      switch (randomDir) {
        case 'UP':
          newGhost.y = (newGhost.y - 1 + GRID_SIZE) % GRID_SIZE;
          break;
        case 'DOWN':
          newGhost.y = (newGhost.y + 1) % GRID_SIZE;
          break;
        case 'LEFT':
          newGhost.x = (newGhost.x - 1 + GRID_SIZE) % GRID_SIZE;
          break;
        case 'RIGHT':
          newGhost.x = (newGhost.x + 1) % GRID_SIZE;
          break;
      }
      return newGhost;
    }

    // AI-specific targeting
    switch (ghost.ai) {
      case 'chaser':
        // Directly chase Pac-Man
        targetPos = pacman;
        break;
      case 'ambusher':
        // Target 4 tiles ahead of Pac-Man
        targetPos = { ...pacman };
        switch (directionRef.current) {
          case 'UP':
            targetPos.y = Math.max(0, targetPos.y - 4);
            break;
          case 'DOWN':
            targetPos.y = Math.min(GRID_SIZE - 1, targetPos.y + 4);
            break;
          case 'LEFT':
            targetPos.x = Math.max(0, targetPos.x - 4);
            break;
          case 'RIGHT':
            targetPos.x = Math.min(GRID_SIZE - 1, targetPos.x + 4);
            break;
        }
        break;
      case 'random':
        // Random movement
        const directions: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'];
        const randomDir = directions[Math.floor(Math.random() * directions.length)];
        const newGhost = { ...ghost };
        
        switch (randomDir) {
          case 'UP':
            newGhost.y = (newGhost.y - 1 + GRID_SIZE) % GRID_SIZE;
            break;
          case 'DOWN':
            newGhost.y = (newGhost.y + 1) % GRID_SIZE;
            break;
          case 'LEFT':
            newGhost.x = (newGhost.x - 1 + GRID_SIZE) % GRID_SIZE;
            break;
          case 'RIGHT':
            newGhost.x = (newGhost.x + 1) % GRID_SIZE;
            break;
        }
        return newGhost;
      case 'patrol':
        // Patrol between corners
        if (!ghost.target) ghost.target = { x: 15, y: 15 };
        if (ghost.x === ghost.target.x && ghost.y === ghost.target.y) {
          const corners = [
            { x: 2, y: 2 },
            { x: 17, y: 2 },
            { x: 2, y: 17 },
            { x: 17, y: 17 }
          ];
          ghost.target = corners[Math.floor(Math.random() * corners.length)];
        }
        targetPos = ghost.target;
        break;
    }

    // Move towards target
    const newGhost = { ...ghost };
    const dx = targetPos.x - ghost.x;
    const dy = targetPos.y - ghost.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      newGhost.x += dx > 0 ? 1 : -1;
    } else {
      newGhost.y += dy > 0 ? 1 : -1;
    }

    // Wrap around
    newGhost.x = (newGhost.x + GRID_SIZE) % GRID_SIZE;
    newGhost.y = (newGhost.y + GRID_SIZE) % GRID_SIZE;

    return newGhost;
  };

  // Game loop
  useEffect(() => {
    if (!gameStarted || gameOver) return;

    const gameLoop = setInterval(() => {
      // Update timers
      if (frightenedTimeRef.current > 0) {
        frightenedTimeRef.current--;
        if (frightenedTimeRef.current === 0) {
          ghostsRef.current = ghostsRef.current.map(g => ({ ...g, mode: 'chase' }));
        }
      }

      if (powerUpTimeRef.current > 0) {
        powerUpTimeRef.current--;
        if (powerUpTimeRef.current === 0) {
          invincibleRef.current = false;
          freezeGhostsRef.current = false;
          speedRef.current = Math.max(50, INITIAL_SPEED - (level - 1) * 10);
          setPowerUpActive(null);
        }
      }

      // Update direction
      directionRef.current = nextDirectionRef.current;

      // Move Pac-Man
      const newPos = { ...pacmanRef.current };
      switch (directionRef.current) {
        case 'UP':
          newPos.y = (newPos.y - 1 + GRID_SIZE) % GRID_SIZE;
          break;
        case 'DOWN':
          newPos.y = (newPos.y + 1) % GRID_SIZE;
          break;
        case 'LEFT':
          newPos.x = (newPos.x - 1 + GRID_SIZE) % GRID_SIZE;
          break;
        case 'RIGHT':
          newPos.x = (newPos.x + 1) % GRID_SIZE;
          break;
      }
      pacmanRef.current = newPos;

      // Check dot collision
      if (dotsRef.current[newPos.y]?.[newPos.x]) {
        dotsRef.current[newPos.y][newPos.x] = false;
        const points = 10 * (combo + 1);
        setScore(s => s + points);
        setCombo(c => c + 1);
        playSound(800, 0.05);
        
        // Add particle effect
        for (let i = 0; i < 3; i++) {
          particlesRef.current.push({
            x: newPos.x * CELL_SIZE + CELL_SIZE / 2,
            y: newPos.y * CELL_SIZE + CELL_SIZE / 2,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
            life: 20,
            color: '#ffff00'
          });
        }
      }

      // Check power pellet collision
      POWER_PELLET_POSITIONS.forEach((pellet, i) => {
        if (pellet.x === newPos.x && pellet.y === newPos.y && powerPelletsRef.current[i]) {
          powerPelletsRef.current[i] = false;
          frightenedTimeRef.current = 50;
          ghostsRef.current = ghostsRef.current.map(g => ({ ...g, mode: 'frightened' }));
          setScore(s => s + 50);
          playSound(600, 0.2);
        }
      });

      // Check power-up collision
      if (powerUpRef.current && powerUpRef.current.x === newPos.x && powerUpRef.current.y === newPos.y) {
        const powerUp = powerUpRef.current;
        powerUpTimeRef.current = 30;
        
        switch (powerUp.type) {
          case 'speed':
            speedRef.current = Math.max(30, speedRef.current / 2);
            setPowerUpActive('⚡ Speed Boost!');
            break;
          case 'freeze':
            freezeGhostsRef.current = true;
            setPowerUpActive('❄️ Ghosts Frozen!');
            break;
          case 'invincible':
            invincibleRef.current = true;
            setPowerUpActive('🛡️ Invincible!');
            break;
        }
        
        powerUpRef.current = null;
        setScore(s => s + 100);
        playSound(1000, 0.3);
      }

      // Move ghosts
      ghostsRef.current = ghostsRef.current.map(moveGhost);

      // Check ghost collision
      for (let i = 0; i < ghostsRef.current.length; i++) {
        const ghost = ghostsRef.current[i];
        if (ghost.x === pacmanRef.current.x && ghost.y === pacmanRef.current.y) {
          if (ghost.mode === 'frightened') {
            // Eat ghost
            const points = 200 * (i + 1);
            setScore(s => s + points);
            playSound(1200, 0.2);
            
            // Add explosion particles
            for (let j = 0; j < 10; j++) {
              const angle = (Math.PI * 2 * j) / 10;
              particlesRef.current.push({
                x: ghost.x * CELL_SIZE + CELL_SIZE / 2,
                y: ghost.y * CELL_SIZE + CELL_SIZE / 2,
                vx: Math.cos(angle) * 3,
                vy: Math.sin(angle) * 3,
                life: 30,
                color: '#00ffff'
              });
            }
            
            // Respawn ghost
            const corners = [
              { x: 5, y: 5 },
              { x: 15, y: 5 },
              { x: 5, y: 15 },
              { x: 15, y: 15 }
            ];
            ghostsRef.current[i] = { ...corners[i], mode: 'chase', ai: ghost.ai, target: ghost.target };
          } else {
            loseLife();
            break;
          }
        }
      }

      // Check if level complete
      const allDotsEaten = dotsRef.current.every(row => row.every(dot => !dot));
      const allPelletsEaten = powerPelletsRef.current.every(p => !p);
      if (allDotsEaten && allPelletsEaten) {
        nextLevel();
      }

      // Draw game
      draw();
    }, speedRef.current);

    return () => clearInterval(gameLoop);
  }, [gameStarted, gameOver, level, lives, combo]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas with gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#000428');
    gradient.addColorStop(1, '#004e92');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines (subtle)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= GRID_SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL_SIZE, 0);
      ctx.lineTo(i * CELL_SIZE, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL_SIZE);
      ctx.lineTo(canvas.width, i * CELL_SIZE);
      ctx.stroke();
    }

    // Draw dots
    ctx.fillStyle = '#fff';
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (dotsRef.current[y]?.[x]) {
          ctx.beginPath();
          ctx.arc(
            x * CELL_SIZE + CELL_SIZE / 2,
            y * CELL_SIZE + CELL_SIZE / 2,
            2,
            0,
            Math.PI * 2
          );
          ctx.fill();
          
          // Glow effect
          ctx.shadowBlur = 5;
          ctx.shadowColor = '#fff';
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    // Draw power pellets
    POWER_PELLET_POSITIONS.forEach((pellet, i) => {
      if (powerPelletsRef.current[i]) {
        const pulse = Math.sin(Date.now() / 200) * 2 + 6;
        ctx.fillStyle = '#ffff00';
        ctx.beginPath();
        ctx.arc(
          pellet.x * CELL_SIZE + CELL_SIZE / 2,
          pellet.y * CELL_SIZE + CELL_SIZE / 2,
          pulse,
          0,
          Math.PI * 2
        );
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ffff00';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    });

    // Draw power-up
    if (powerUpRef.current) {
      const pu = powerUpRef.current;
      const pulse = Math.sin(Date.now() / 150) * 3 + 8;
      
      let color = '#00ff00';
      let symbol = '⚡';
      if (pu.type === 'freeze') {
        color = '#00ffff';
        symbol = '❄️';
      } else if (pu.type === 'invincible') {
        color = '#ff00ff';
        symbol = '🛡️';
      }
      
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(
        pu.x * CELL_SIZE + CELL_SIZE / 2,
        pu.y * CELL_SIZE + CELL_SIZE / 2,
        pulse,
        0,
        Math.PI * 2
      );
      ctx.shadowBlur = 15;
      ctx.shadowColor = color;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw Pac-Man with animation
    const mouthAngle = Math.sin(Date.now() / 100) * 0.2 + 0.2;
    let rotation = 0;
    switch (directionRef.current) {
      case 'RIGHT':
        rotation = 0;
        break;
      case 'DOWN':
        rotation = Math.PI / 2;
        break;
      case 'LEFT':
        rotation = Math.PI;
        break;
      case 'UP':
        rotation = -Math.PI / 2;
        break;
    }

    ctx.save();
    ctx.translate(
      pacmanRef.current.x * CELL_SIZE + CELL_SIZE / 2,
      pacmanRef.current.y * CELL_SIZE + CELL_SIZE / 2
    );
    ctx.rotate(rotation);
    
    if (invincibleRef.current) {
      ctx.fillStyle = `hsl(${Date.now() / 10 % 360}, 100%, 50%)`;
      ctx.shadowBlur = 20;
      ctx.shadowColor = ctx.fillStyle;
    } else {
      ctx.fillStyle = '#ffff00';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffff00';
    }
    
    ctx.beginPath();
    ctx.arc(0, 0, CELL_SIZE / 2 - 2, mouthAngle * Math.PI, (2 - mouthAngle) * Math.PI);
    ctx.lineTo(0, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Draw ghosts with different styles
    ghostsRef.current.forEach((ghost, i) => {
      const colors = ['#ff0000', '#00ffff', '#ffb8ff', '#ffb852'];
      const frightenedColor = '#0000ff';
      const isFreeze = freezeGhostsRef.current;
      
      ctx.fillStyle = ghost.mode === 'frightened' ? frightenedColor : (isFreeze ? '#88ccff' : colors[i]);
      
      // Ghost body
      ctx.beginPath();
      ctx.arc(
        ghost.x * CELL_SIZE + CELL_SIZE / 2,
        ghost.y * CELL_SIZE + CELL_SIZE / 2 - 2,
        CELL_SIZE / 2 - 2,
        Math.PI,
        0
      );
      
      // Ghost bottom with wavy edge
      const waveOffset = Math.sin(Date.now() / 200 + i) * 2;
      ctx.lineTo(ghost.x * CELL_SIZE + CELL_SIZE - 2, ghost.y * CELL_SIZE + CELL_SIZE / 2 + 4);
      ctx.lineTo(ghost.x * CELL_SIZE + CELL_SIZE - 4, ghost.y * CELL_SIZE + CELL_SIZE / 2 + 2 + waveOffset);
      ctx.lineTo(ghost.x * CELL_SIZE + CELL_SIZE / 2, ghost.y * CELL_SIZE + CELL_SIZE / 2 + 4);
      ctx.lineTo(ghost.x * CELL_SIZE + 4, ghost.y * CELL_SIZE + CELL_SIZE / 2 + 2 - waveOffset);
      ctx.lineTo(ghost.x * CELL_SIZE + 2, ghost.y * CELL_SIZE + CELL_SIZE / 2 + 4);
      ctx.closePath();
      
      ctx.shadowBlur = 10;
      ctx.shadowColor = ctx.fillStyle;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Ghost eyes
      if (ghost.mode !== 'frightened') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(ghost.x * CELL_SIZE + CELL_SIZE / 2 - 3, ghost.y * CELL_SIZE + CELL_SIZE / 2 - 2, 3, 0, Math.PI * 2);
        ctx.arc(ghost.x * CELL_SIZE + CELL_SIZE / 2 + 3, ghost.y * CELL_SIZE + CELL_SIZE / 2 - 2, 3, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(ghost.x * CELL_SIZE + CELL_SIZE / 2 - 3, ghost.y * CELL_SIZE + CELL_SIZE / 2 - 2, 1.5, 0, Math.PI * 2);
        ctx.arc(ghost.x * CELL_SIZE + CELL_SIZE / 2 + 3, ghost.y * CELL_SIZE + CELL_SIZE / 2 - 2, 1.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Frightened face
        ctx.fillStyle = '#fff';
        ctx.font = '8px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('😱', ghost.x * CELL_SIZE + CELL_SIZE / 2, ghost.y * CELL_SIZE + CELL_SIZE / 2 + 2);
      }
    });

    // Update and draw particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      
      if (p.life > 0) {
        ctx.fillStyle = p.color + Math.floor((p.life / 30) * 255).toString(16).padStart(2, '0');
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
        return true;
      }
      return false;
    });

    // Particle effects for combo
    if (combo > 5) {
      for (let i = 0; i < 3; i++) {
        const angle = (Date.now() / 500 + i * Math.PI * 2 / 3) % (Math.PI * 2);
        const radius = 15 + Math.sin(Date.now() / 200) * 5;
        const x = pacmanRef.current.x * CELL_SIZE + CELL_SIZE / 2 + Math.cos(angle) * radius;
        const y = pacmanRef.current.y * CELL_SIZE + CELL_SIZE / 2 + Math.sin(angle) * radius;
        
        ctx.fillStyle = `hsla(${Date.now() / 10 % 360}, 100%, 50%, 0.6)`;
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw trail effect for Pac-Man when moving fast
    if (speedRef.current < 100) {
      ctx.fillStyle = 'rgba(255, 255, 0, 0.2)';
      ctx.beginPath();
      ctx.arc(
        pacmanRef.current.x * CELL_SIZE + CELL_SIZE / 2,
        pacmanRef.current.y * CELL_SIZE + CELL_SIZE / 2,
        CELL_SIZE / 2 + 5,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }
  };

  // Initial draw
  useEffect(() => {
    draw();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-gray-900 to-black text-white p-4">
      <div className="mb-6 text-center">
        <h1 className="text-5xl font-bold mb-2 text-yellow-400 drop-shadow-[0_0_10px_rgba(255,255,0,0.5)]">
          PAC-MAN ADVANCED
        </h1>
        <div className="flex gap-6 justify-center text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Score:</span>
            <span className="text-2xl font-bold text-yellow-400">{score}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">High Score:</span>
            <span className="text-xl font-bold text-green-400">{highScore}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Level:</span>
            <span className="text-2xl font-bold text-blue-400">{level}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-400">Lives:</span>
            <span className="text-2xl font-bold text-red-400">{'❤️'.repeat(lives)}</span>
          </div>
        </div>
        {combo > 0 && (
          <div className="mt-2 text-lg font-bold text-purple-400 animate-pulse">
            🔥 COMBO x{combo}!
          </div>
        )}
        {powerUpActive && (
          <div className="mt-2 text-xl font-bold text-green-400 animate-bounce">
            {powerUpActive}
          </div>
        )}
      </div>
      
      <canvas
        ref={canvasRef}
        width={GRID_SIZE * CELL_SIZE}
        height={GRID_SIZE * CELL_SIZE}
        className="border-4 border-blue-500 rounded-lg shadow-[0_0_20px_rgba(59,130,246,0.5)] mb-4"
      />

      <div className="flex gap-4 mb-4">
        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          {soundEnabled ? '🔊 Sound On' : '🔇 Sound Off'}
        </button>
        {gameOver && (
          <button
            onClick={resetGame}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-bold transition-colors"
          >
            🔄 Play Again
          </button>
        )}
      </div>

      {!gameStarted && !gameOver && (
        <div className="text-center bg-gray-800 bg-opacity-90 p-6 rounded-lg max-w-md">
          <p className="text-2xl mb-4 font-bold text-yellow-400">Ready to Play?</p>
          <p className="text-lg mb-4">Press any arrow key to start!</p>
          <div className="text-left space-y-2 text-sm">
            <p className="text-gray-300">🎮 <strong>Controls:</strong> Arrow keys or WASD</p>
            <p className="text-gray-300">🟡 <strong>Dots:</strong> +10 points (combo bonus!)</p>
            <p className="text-gray-300">⭐ <strong>Power Pellets:</strong> +50 points, frighten ghosts</p>
            <p className="text-gray-300">👻 <strong>Eat Frightened Ghosts:</strong> +200-800 points</p>
            <p className="text-gray-300">⚡ <strong>Power-ups:</strong> Speed, Freeze, Invincibility</p>
            <p className="text-gray-300">🎯 <strong>Complete Level:</strong> Advance to harder levels</p>
            <p className="text-gray-300">❤️ <strong>Lives:</strong> 3 chances to survive</p>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-xs text-gray-400">
              <strong>Ghost AI:</strong> Red=Chaser, Cyan=Ambusher, Pink=Random, Orange=Patrol
            </p>
          </div>
        </div>
      )}

      {gameOver && (
        <div className="text-center bg-gray-800 bg-opacity-90 p-8 rounded-lg">
          <p className="text-4xl text-red-500 mb-4 font-bold animate-pulse">GAME OVER!</p>
          <p className="text-2xl mb-2">Final Score: <span className="text-yellow-400 font-bold">{score}</span></p>
          <p className="text-xl mb-2">Level Reached: <span className="text-blue-400 font-bold">{level}</span></p>
          {score === highScore && score > 0 && (
            <p className="text-2xl text-green-400 mb-4 font-bold animate-bounce">
              🏆 NEW HIGH SCORE! 🏆
            </p>
          )}
          <p className="text-sm text-gray-400 mt-4">Press R to restart or click the button above</p>
        </div>
      )}

      {gameStarted && !gameOver && (
        <div className="text-center text-xs text-gray-500 mt-2">
          <p>Press R to restart • Speed: {Math.round(1000 / speedRef.current)}x</p>
        </div>
      )}
    </div>
  );
}











