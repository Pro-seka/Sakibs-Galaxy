// Game Constants
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 700;
const PLAYER_SPEED = 5;
const BULLET_SPEED = 10;
const ENEMY_SPAWN_RATE = 60;
const POWERUP_SPAWN_RATE = 500;

// Enhanced Sound Effects System
const soundEnabled = true;
let audioContext;

function initAudio() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        console.warn("Web Audio API not supported");
    }
}

function playSound(type) {
    if (!soundEnabled || !audioContext) return;
    
    const sounds = {
        'shoot': { 
            freq: 600,
            duration: 0.08,
            type: 'sine',
            volume: 0.2,
            fade: 0.05
        },
        'explosion': { 
            freq: 80, 
            duration: 0.4, 
            type: 'sine', 
            volume: 0.3,
            fade: 0.3
        },
        'hit': { 
            freq: 200, 
            duration: 0.15, 
            type: 'sine', 
            volume: 0.15,
            fade: 0.1
        },
        'powerup': { 
            freq: 800, 
            duration: 0.25, 
            type: 'triangle', 
            volume: 0.25,
            freqEnd: 1200,
            fade: 0.2
        }
    };
    
    const sound = sounds[type];
    if (!sound) return;

    const now = audioContext.currentTime;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.type = sound.type;
    oscillator.frequency.setValueAtTime(sound.freq, now);
    
    if (type === 'shoot') {
        oscillator.frequency.exponentialRampToValueAtTime(
            sound.freq * 0.7, 
            now + sound.duration
        );
    }
    if (sound.freqEnd) {
        oscillator.frequency.exponentialRampToValueAtTime(
            sound.freqEnd, 
            now + sound.duration
        );
    }
    
    gainNode.gain.setValueAtTime(sound.volume, now);
    gainNode.gain.exponentialRampToValueAtTime(
        0.001, 
        now + sound.duration
    );
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.start(now);
    oscillator.stop(now + sound.duration);
}

// Game Variables
let canvas, ctx;
let gameRunning = false;
let score = 0;
let level = 1;
let playerHealth = 100;
let enemies = [];
let bullets = [];
let powerUps = [];
let particles = [];
let keys = {};
let lastEnemySpawn = 0;
let lastPowerUpSpawn = 0;
let frameCount = 0;
let enemySpawnRate = ENEMY_SPAWN_RATE;
let gameTime = 0;
let beastMode = false;
let currentLevelType = 1; // 1 for normal level, 2 for harder level

// Mobile Control Variables
let joystickActive = false;
let joystickAngle = 0;
let joystickDistance = 0;
let touchId = null;
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Player Stats
let playerStats = {
    fireRate: 15,
    bulletDamage: 10,
    bulletSize: 5,
    speed: PLAYER_SPEED,
    lastShot: 0
};

// Enemy Types for Level 1
const enemyTypesLevel1 = [
    { color: '#ff5555', size: 30, health: 30, speed: 2, score: 50, behavior: 'straight' },
    { color: '#ffaa00', size: 25, health: 20, speed: 3.5, score: 75, behavior: 'zigzag' },
    { color: '#aa0000', size: 40, health: 80, speed: 1.5, score: 150, behavior: 'straight' },
    { color: '#ff00ff', size: 60, health: 200, speed: 1, score: 500, behavior: 'homing' }
];

// Enemy Types for Level 2 (more challenging)
const enemyTypesLevel2 = [
    { color: '#ff5555', size: 25, health: 40, speed: 3, score: 60, behavior: 'zigzag' },
    { color: '#ffaa00', size: 20, health: 25, speed: 4.5, score: 85, behavior: 'zigzag' },
    { color: '#aa0000', size: 35, health: 100, speed: 2, score: 175, behavior: 'homing' },
    { color: '#ff00ff', size: 50, health: 250, speed: 1.2, score: 600, behavior: 'homing' },
    { color: '#00ff00', size: 40, health: 150, speed: 2.5, score: 300, behavior: 'spiral' },
    { color: '#5555ff', size: 45, health: 180, speed: 1.8, score: 400, behavior: 'shooter' }
];

// Power-up Types
const powerUpTypes = [
    { type: 'health', color: '#00ff00', size: 20, value: 20 },
    { type: 'fireRate', color: '#ffff00', size: 20, value: -2 },
    { type: 'damage', color: '#ff0000', size: 20, value: 5 },
    { type: 'speed', color: '#00ffff', size: 20, value: 1 }
];

// Player Object
const player = {
    x: CANVAS_WIDTH / 2,
    y: CANVAS_HEIGHT / 2,
    width: 40,
    height: 40,
    color: '#4a6fe8',
    draw() {
        ctx.save();
        ctx.fillStyle = this.color;
        
        ctx.beginPath();
        ctx.moveTo(this.x, this.y - this.height/2);
        ctx.lineTo(this.x + this.width/2, this.y + this.height/2);
        ctx.lineTo(this.x - this.width/2, this.y + this.height/2);
        ctx.closePath();
        ctx.fill();
        
        ctx.beginPath();
        ctx.moveTo(this.x - this.width/4, this.y + this.height/2);
        ctx.lineTo(this.x, this.y + this.height/2 + 10 + Math.sin(frameCount * 0.2) * 5);
        ctx.lineTo(this.x + this.width/4, this.y + this.height/2);
        ctx.closePath();
        ctx.fillStyle = '#00ffff';
        ctx.fill();
        
        ctx.restore();
    },
    update() {
        // Movement
        let moveX = 0;
        let moveY = 0;
        
        if (keys['ArrowLeft'] || keys['a']) moveX -= playerStats.speed;
        if (keys['ArrowRight'] || keys['d']) moveX += playerStats.speed;
        if (keys['ArrowUp'] || keys['w']) moveY -= playerStats.speed;
        if (keys['ArrowDown'] || keys['s']) moveY += playerStats.speed;
        
        // Diagonal movement normalization
        if (moveX !== 0 && moveY !== 0) {
            moveX *= 0.7071;
            moveY *= 0.7071;
        }
        
        this.x += moveX;
        this.y += moveY;
        
        // Boundary checking
        this.x = Math.max(this.width/2, Math.min(CANVAS_WIDTH - this.width/2, this.x));
        this.y = Math.max(this.height/2, Math.min(CANVAS_HEIGHT - this.height/2, this.y));
        
        // Shooting
        if ((keys[' '] || keys['Spacebar']) && frameCount - playerStats.lastShot >= playerStats.fireRate) {
            shootBullet();
            if (beastMode) {
                shootSideBullets();
            }
            playerStats.lastShot = frameCount;
        }
    }
};

// Initialize Game
function init() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;
    
    // Event listeners
    document.addEventListener('keydown', (e) => keys[e.key] = true);
    document.addEventListener('keyup', (e) => keys[e.key] = false);
    
    // Mobile touch controls
    if (isMobile) {
        setupMobileControls();
    }
    
    document.getElementById('startButton').addEventListener('click', () => {
        beastMode = false;
        startGame();
    });
    document.getElementById('beastModeButton').addEventListener('click', () => {
        beastMode = true;
        startGame();
    });
    document.getElementById('restartButton').addEventListener('click', restartGame);
    
    // Initialize audio on first click
    document.addEventListener('click', () => {
        if (!audioContext) {
            initAudio();
            playSound('powerup');
        }
    }, { once: true });
    
    // Hide cursor
    canvas.style.cursor = 'none';
    
    // Initial UI update for mobile scaling
    updateUI();
}

// Setup Mobile Controls
function setupMobileControls() {
    const leftControl = document.getElementById('leftControl');
    const joystick = document.getElementById('joystick');
    const fireButton = document.getElementById('fireButton');
    
    // Ensure controls are positioned correctly
    leftControl.style.position = 'relative';
    leftControl.style.left = '0';
    joystick.style.position = 'absolute';
    joystick.style.top = '30px';
    joystick.style.left = '30px';
    
    // Joystick touch events
    leftControl.addEventListener('touchstart', handleTouchStart, { passive: false });
    leftControl.addEventListener('touchmove', handleTouchMove, { passive: false });
    leftControl.addEventListener('touchend', handleTouchEnd, { passive: false });
    
    // Fire button
    fireButton.addEventListener('touchstart', () => {
        keys[' '] = true;
    });
    
    fireButton.addEventListener('touchend', () => {
        keys[' '] = false;
    });
    
    function handleTouchStart(e) {
        e.preventDefault();
        if (touchId === null) {
            const touch = e.touches[0];
            touchId = touch.identifier;
            joystickActive = true;
            updateJoystickPosition(touch.clientX, touch.clientY);
        }
    }
    
    function handleTouchMove(e) {
        e.preventDefault();
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === touchId) {
                updateJoystickPosition(e.touches[i].clientX, e.touches[i].clientY);
                break;
            }
        }
    }
    
    function handleTouchEnd(e) {
        e.preventDefault();
        for (let i = 0; i < e.changedTouches.length; i++) {
            if (e.changedTouches[i].identifier === touchId) {
                resetJoystick();
                touchId = null;
                break;
            }
        }
    }
    
    function updateJoystickPosition(touchX, touchY) {
        const rect = leftControl.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        const deltaX = touchX - centerX;
        const deltaY = touchY - centerY;
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        
        const maxDistance = rect.width / 2;
        joystickDistance = Math.min(distance, maxDistance);
        joystickAngle = Math.atan2(deltaY, deltaX);
        
        const joystickX = Math.cos(joystickAngle) * joystickDistance;
        const joystickY = Math.sin(joystickAngle) * joystickDistance;
        
        joystick.style.transform = `translate(${joystickX}px, ${joystickY}px)`;
        
        updateMovementFromJoystick();
    }
    
    function resetJoystick() {
        joystick.style.transform = 'translate(0, 0)';
        joystickActive = false;
        joystickDistance = 0;
        keys['ArrowLeft'] = false;
        keys['ArrowRight'] = false;
        keys['ArrowUp'] = false;
        keys['ArrowDown'] = false;
    }
    
    function updateMovementFromJoystick() {
        if (!joystickActive) return;
        
        const threshold = 20;
        
        keys['ArrowLeft'] = false;
        keys['ArrowRight'] = false;
        keys['ArrowUp'] = false;
        keys['ArrowDown'] = false;
        
        if (joystickDistance > threshold) {
            const angle = joystickAngle;
            
            if (angle > -Math.PI/4 && angle < Math.PI/4) {
                keys['ArrowRight'] = true;
            }
            else if (angle > 3*Math.PI/4 || angle < -3*Math.PI/4) {
                keys['ArrowLeft'] = true;
            }
            
            if (angle < -Math.PI/4 && angle > -3*Math.PI/4) {
                keys['ArrowUp'] = true;
            }
            else if (angle > Math.PI/4 && angle < 3*Math.PI/4) {
                keys['ArrowDown'] = true;
            }
        }
    }
}

// Start Game
function startGame() {
    document.getElementById('startScreen').style.display = 'none';
    gameRunning = true;
    score = 0;
    level = 1;
    currentLevelType = 1;
    playerHealth = 100;
    enemies = [];
    bullets = [];
    powerUps = [];
    particles = [];
    playerStats = {
        fireRate: 15,
        bulletDamage: 10,
        bulletSize: 5,
        speed: PLAYER_SPEED,
        lastShot: 0
    };
    enemySpawnRate = ENEMY_SPAWN_RATE;
    gameTime = 0;
    
    updateUI();
    gameLoop();
}

// Restart Game
function restartGame() {
    document.getElementById('gameOver').style.display = 'none';
    startGame();
}

// Game Over
function gameOver() {
    gameRunning = false;
    document.getElementById('finalScore').textContent = score;
    document.getElementById('gameOver').style.display = 'flex';
}

// Optimized Game Loop
function gameLoop() {
    if (!gameRunning) return;
    
    frameCount++;
    gameTime++;
    
    // Check if we should transition to level 2
    if (score >= 1000 && currentLevelType === 1) {
        currentLevelType = 2;
        level = 404; // Start level 2 at level 11 to indicate higher difficulty
        enemySpawnRate = Math.max(5, ENEMY_SPAWN_RATE - 30); // Faster spawn rate for level 2
    }
    
    // Clear canvas efficiently
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    drawStarfield();
    
    // Spawn enemies with optimized timing
    if (frameCount - lastEnemySpawn > enemySpawnRate) {
        spawnEnemy();
        lastEnemySpawn = frameCount;
        
        // Level progression
        if (frameCount % 1000 === 0) {
            level++;
            enemySpawnRate = Math.max(5, enemySpawnRate - 1);
            updateUI();
        }
    }
    
    // Spawn power-ups less frequently
    if (frameCount - lastPowerUpSpawn > POWERUP_SPAWN_RATE && Math.random() < 0.02) {
        spawnPowerUp();
        lastPowerUpSpawn = frameCount;
    }
    
    player.update();
    player.draw();
    
    updateBullets();
    updateEnemies();
    updatePowerUps();
    updateParticles();
    
    checkCollisions();
    updateUI();
    
    requestAnimationFrame(gameLoop);
}

// Optimized Starfield Drawing
function drawStarfield() {
    ctx.fillStyle = 'white';
    
    // Draw static stars
    ctx.globalAlpha = 0.8;
    for (let i = 0; i < 200; i++) {
        const x = (i * 12345) % CANVAS_WIDTH;
        const y = (i * 32123) % CANVAS_HEIGHT;
        const size = (i % 3) * 0.5 + 0.5;
        ctx.fillRect(x, y, size, size);
    }
    
    // Draw moving stars
    ctx.globalAlpha = 0.6;
    for (let i = 0; i < 100; i++) {
        const x = (i * 54321 + frameCount * 0.5) % CANVAS_WIDTH;
        const y = (i * 12345) % CANVAS_HEIGHT;
        ctx.fillRect(x, y, 1, 1);
    }
    
    ctx.globalAlpha = 1.0;
}

// Spawn Enemy
function spawnEnemy() {
    let x, y;
    const side = Math.floor(Math.random() * 4);
    
    switch (side) {
        case 0:
            x = Math.random() * CANVAS_WIDTH;
            y = -50;
            break;
        case 1:
            x = CANVAS_WIDTH + 50;
            y = Math.random() * CANVAS_HEIGHT;
            break;
        case 2:
            x = Math.random() * CANVAS_WIDTH;
            y = CANVAS_HEIGHT + 50;
            break;
        case 3:
            x = -50;
            y = Math.random() * CANVAS_HEIGHT;
            break;
    }
    
    // Choose enemy types based on current level
    const enemyTypes = currentLevelType === 1 ? enemyTypesLevel1 : enemyTypesLevel2;
    
    let typeIndex = 0;
    const r = Math.random();
    
    if (currentLevelType === 1) {
        if (level > 10 && r < 0.05) typeIndex = 3;
        else if (level > 5 && r < 0.3) typeIndex = 2;
        else if (level > 3 && r < 0.5) typeIndex = 1;
    } else {
        // Level 2 enemy distribution
        if (r < 0.05) typeIndex = 5; // Shooter (rare)
        else if (r < 0.15) typeIndex = 4; // Spiral
        else if (r < 0.3) typeIndex = 3; // Homing
        else if (r < 0.6) typeIndex = 2; // Fast zigzag
        else typeIndex = 1; // Basic zigzag
    }
    
    const type = enemyTypes[typeIndex];
    
    enemies.push({
        x: x, y: y,
        width: type.size, height: type.size,
        color: type.color, health: type.health,
        maxHealth: type.health, speed: type.speed,
        score: type.score, behavior: type.behavior,
        angle: Math.random() * Math.PI * 2,
        zigzagCounter: 0,
        spiralCounter: 0,
        lastShot: 0,
        draw() {
            ctx.save();
            ctx.fillStyle = this.color;
            
            // Different shapes for different behaviors
            if (this.behavior === 'shooter') {
                // Shooter enemy looks different
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.width/2, 0, Math.PI * 2);
                ctx.fill();
                
                // Draw cannon
                ctx.fillStyle = '#333';
                ctx.fillRect(this.x - this.width/4, this.y - this.width/2, this.width/2, this.width);
            } else {
                // Standard triangle enemy
                ctx.beginPath();
                ctx.moveTo(this.x, this.y + this.height/2);
                ctx.lineTo(this.x + this.width/2, this.y - this.height/2);
                ctx.lineTo(this.x - this.width/2, this.y - this.height/2);
                ctx.closePath();
                ctx.fill();
            }
            
            // Health bar
            if (this.health < this.maxHealth) {
                const healthPercent = this.health / this.maxHealth;
                ctx.fillStyle = 'red';
                ctx.fillRect(this.x - this.width/2, this.y - this.height/2 - 10, this.width, 3);
                ctx.fillStyle = 'lime';
                ctx.fillRect(this.x - this.width/2, this.y - this.height/2 - 10, this.width * healthPercent, 3);
            }
            ctx.restore();
        },
        update() {
            switch (this.behavior) {
                case 'straight':
                    const angle = Math.atan2(player.y - this.y, player.x - this.x);
                    this.x += Math.cos(angle) * this.speed;
                    this.y += Math.sin(angle) * this.speed;
                    break;
                case 'zigzag':
                    this.zigzagCounter += 0.1;
                    const baseAngle = Math.atan2(player.y - this.y, player.x - this.x);
                    this.angle = baseAngle + Math.sin(this.zigzagCounter) * 0.5;
                    this.x += Math.cos(this.angle) * this.speed;
                    this.y += Math.sin(this.angle) * this.speed;
                    break;
                case 'homing':
                    if (Math.random() < 0.02) {
                        this.angle = Math.atan2(player.y - this.y, player.x - this.x);
                    }
                    this.x += Math.cos(this.angle) * this.speed;
                    this.y += Math.sin(this.angle) * this.speed;
                    break;
                case 'spiral':
                    this.spiralCounter += 0.05;
                    const targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
                    this.angle = targetAngle + Math.sin(this.spiralCounter) * 2;
                    this.x += Math.cos(this.angle) * this.speed;
                    this.y += Math.sin(this.angle) * this.speed;
                    break;
                case 'shooter':
                    // Move toward player but maintain distance
                    const distToPlayer = Math.sqrt(Math.pow(player.x - this.x, 2) + Math.pow(player.y - this.y, 2));
                    const desiredDist = 300;
                    
                    if (distToPlayer > desiredDist) {
                        const angle = Math.atan2(player.y - this.y, player.x - this.x);
                        this.x += Math.cos(angle) * this.speed;
                        this.y += Math.sin(angle) * this.speed;
                    } else if (distToPlayer < desiredDist - 50) {
                        const angle = Math.atan2(player.y - this.y, player.x - this.x);
                        this.x -= Math.cos(angle) * this.speed;
                        this.y -= Math.sin(angle) * this.speed;
                    }
                    
                    // Shoot at player
                    if (frameCount - this.lastShot > 60 && Math.random() < 0.02) {
                        this.lastShot = frameCount;
                        const angle = Math.atan2(player.y - this.y, player.x - this.x);
                        
                        // Create enemy bullet
                        bullets.push({
                            x: this.x,
                            y: this.y,
                            width: 8,
                            height: 8,
                            color: '#ff0000',
                            speed: 5,
                            damage: 15,
                            angle: angle,
                            draw() {
                                ctx.save();
                                ctx.fillStyle = this.color;
                                ctx.beginPath();
                                ctx.arc(this.x, this.y, this.width/2, 0, Math.PI * 2);
                                ctx.fill();
                                ctx.restore();
                            },
                            update() {
                                this.x += Math.cos(this.angle) * this.speed;
                                this.y += Math.sin(this.angle) * this.speed;
                                return this.x < -this.width || this.x > CANVAS_WIDTH + this.width ||
                                       this.y < -this.height || this.y > CANVAS_HEIGHT + this.height;
                            }
                        });
                    }
                    break;
            }
        }
    });
}

// Shoot Bullet
function shootBullet() {
    bullets.push({
        x: player.x,
        y: player.y - player.height/2,
        width: playerStats.bulletSize,
        height: playerStats.bulletSize * 2,
        color: '#00ffff',
        speed: BULLET_SPEED,
        damage: playerStats.bulletDamage,
        draw() {
            ctx.save();
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
            ctx.beginPath();
            ctx.arc(this.x, this.y + this.height, this.width, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.restore();
        },
        update() {
            this.y -= this.speed;
            return this.y < -this.height;
        }
    });
    
    playSound('shoot');
}

// Shoot Side Bullets (for Beast Mode)
function shootSideBullets() {
    bullets.push({
        x: player.x - player.width/2,
        y: player.y,
        width: playerStats.bulletSize,
        height: playerStats.bulletSize * 2,
        color: '#ff5555',
        speed: BULLET_SPEED,
        damage: playerStats.bulletDamage,
        draw() {
            ctx.save();
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
            ctx.beginPath();
            ctx.arc(this.x, this.y + this.height, this.width, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.restore();
        },
        update() {
            this.x -= this.speed * 0.7;
            this.y -= this.speed * 0.7;
            return this.y < -this.height || this.x < -this.width;
        }
    });
    
    bullets.push({
        x: player.x + player.width/2,
        y: player.y,
        width: playerStats.bulletSize,
        height: playerStats.bulletSize * 2,
        color: '#ff5555',
        speed: BULLET_SPEED,
        damage: playerStats.bulletDamage,
        draw() {
            ctx.save();
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.width/2, this.y, this.width, this.height);
            ctx.beginPath();
            ctx.arc(this.x, this.y + this.height, this.width, 0, Math.PI * 2);
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.restore();
        },
        update() {
            this.x += this.speed * 0.7;
            this.y -= this.speed * 0.7;
            return this.y < -this.height || this.x > CANVAS_WIDTH + this.width;
        }
    });
}

// Spawn Power-up
function spawnPowerUp() {
    const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
    
    powerUps.push({
        x: Math.random() * (CANVAS_WIDTH - 50) + 25,
        y: Math.random() * (CANVAS_HEIGHT - 50) + 25,
        width: type.size,
        height: type.size,
        color: type.color,
        type: type.type,
        value: type.value,
        draw() {
            ctx.save();
            ctx.fillStyle = this.color;
            
            switch (this.type) {
                case 'health':
                    ctx.fillRect(this.x - this.width/3, this.y - this.width/2, this.width/1.5, this.width);
                    ctx.fillRect(this.x - this.width/2, this.y - this.width/3, this.width, this.width/1.5);
                    break;
                case 'fireRate':
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y - this.width/2);
                    ctx.lineTo(this.x + this.width/3, this.y);
                    ctx.lineTo(this.x - this.width/3, this.y);
                    ctx.lineTo(this.x, this.y + this.width/2);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case 'damage':
                    drawStar(this.x, this.y, 5, this.width/2, this.width/4);
                    break;
                case 'speed':
                    ctx.beginPath();
                    ctx.arc(this.x, this.y, this.width/2, 0, Math.PI * 2);
                    ctx.fill();
                    break;
            }
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width/2 + Math.sin(frameCount * 0.1) * 2, 0, Math.PI * 2);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.stroke();
            ctx.restore();
        },
        update() {
            return false;
        }
    });
}

// Draw Star (for damage power-up)
function drawStar(cx, cy, spikes, outerRadius, innerRadius) {
    let rot = Math.PI/2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

                x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
}

// Update Bullets
function updateBullets() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        const shouldRemove = bullet.update();
        
        bullet.draw();
        
        if (shouldRemove) {
            bullets.splice(i, 1);
        }
    }
}

// Update Enemies
function updateEnemies() {
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        enemy.update();
        enemy.draw();
        
        if (enemy.x < -100 || enemy.x > CANVAS_WIDTH + 100 || 
            enemy.y < -100 || enemy.y > CANVAS_HEIGHT + 100) {
            enemies.splice(i, 1);
        }
    }
}

// Update Power-ups
function updatePowerUps() {
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        powerUp.draw();
    }
}

// Create Particles
function createParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        
        particles.push({
            x: x, y: y,
            size: Math.random() * 4 + 2,
            color: color,
            speedX: Math.cos(angle) * speed,
            speedY: Math.sin(angle) * speed,
            life: 30 + Math.random() * 20,
            draw() {
                ctx.save();
                ctx.globalAlpha = this.life / 50;
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            },
            update() {
                this.x += this.speedX;
                this.y += this.speedY;
                this.life--;
                return this.life <= 0;
            }
        });
    }
}

// Update Particles
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];
        const shouldRemove = particle.update();
        
        particle.draw();
        
        if (shouldRemove) {
            particles.splice(i, 1);
        }
    }
}

// Check Collisions
function checkCollisions() {
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        
        for (let j = enemies.length - 1; j >= 0; j--) {
            const enemy = enemies[j];
            
            if (checkCollision(bullet, enemy)) {
                enemy.health -= bullet.damage;
                createParticles(bullet.x, bullet.y, enemy.color, 5);
                bullets.splice(i, 1);
                
                if (enemy.health <= 0) {
                    score += enemy.score;
                    createParticles(enemy.x, enemy.y, enemy.color, 20);
                    playSound('explosion');
                    enemies.splice(j, 1);
                    
                    if (Math.random() < 0.2) {
                        spawnPowerUp();
                    }
                }
                break;
            }
        }
    }
    
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        
        if (checkCollision(player, enemy)) {
            playerHealth -= 10 + level;
            createParticles(enemy.x, enemy.y, enemy.color, 15);
            playSound('hit');
            enemies.splice(i, 1);
            
            if (playerHealth <= 0) {
                gameOver();
                return;
            }
        }
    }
    
    for (let i = powerUps.length - 1; i >= 0; i--) {
        const powerUp = powerUps[i];
        
        if (checkCollision(player, powerUp)) {
            applyPowerUp(powerUp);
            playSound('powerup');
            powerUps.splice(i, 1);
        }
    }
}

// Check Collision Between Two Objects
function checkCollision(obj1, obj2) {
    return obj1.x < obj2.x + obj2.width/2 &&
           obj1.x > obj2.x - obj2.width/2 &&
           obj1.y < obj2.y + obj2.height/2 &&
           obj1.y > obj2.y - obj2.height/2;
}

// Apply Power-up
function applyPowerUp(powerUp) {
    switch (powerUp.type) {
        case 'health':
            playerHealth = Math.min(100, playerHealth + powerUp.value);
            break;
        case 'fireRate':
            playerStats.fireRate = Math.max(5, playerStats.fireRate + powerUp.value);
            break;
        case 'damage':
            playerStats.bulletDamage += powerUp.value;
            break;
        case 'speed':
            playerStats.speed += powerUp.value;
            break;
    }
    createParticles(powerUp.x, powerUp.y, powerUp.color, 15);
}

// Update UI
function updateUI() {
    document.getElementById('score').textContent = score;
    document.getElementById('level').textContent = level;
    document.getElementById('health').textContent = playerHealth;
    document.getElementById('mode').textContent = beastMode ? "BEAST MODE" : "NORMAL";
    
    // Mobile-specific UI adjustments
    if (isMobile) {
        // Scale canvas to fit mobile screen while maintaining aspect ratio
        const scale = Math.min(
            window.innerWidth / CANVAS_WIDTH, 
            window.innerHeight / CANVAS_HEIGHT
        ) * 0.9; // 90% of available space
        
        canvas.style.width = (CANVAS_WIDTH * scale) + 'px';
        canvas.style.height = (CANVAS_HEIGHT * scale) + 'px';
        
        // Update font sizes for mobile
        document.getElementById('ui').style.fontSize = '14px';
    }
}

// Initialize the game when the page loads
window.onload = init;
