// --- DOM ELEMENTS ---
const mainContainer = document.getElementById('main-container');
const startScreen = document.getElementById('start-screen');
const settingsArea = document.getElementById('settings-area');
const startButton = document.getElementById('start-button');
const singlePlayerButton = document.getElementById('single-player-button');
const twoPlayerButton = document.getElementById('two-player-button');
const speedSlider = document.getElementById('base-speed-slider');
const speedValueDisplay = document.getElementById('speed-value');
const restartScreen = document.getElementById('restart-screen');
const restartButton = document.getElementById('restart-button');
const finalScoreDisplay = document.getElementById('final-score');
const fullscreenButton = document.getElementById('fullscreen-button');
const highScoreDisplay = document.getElementById('high-score-display');
let highScore = localStorage.getItem('vectorDashHighScore') || 0;
highScoreDisplay.textContent = `High Score: ${highScore}`;


// Key Inputs
const p1FlipKeyInput = document.getElementById('p1-flip-key-input');
const p1BoostKeyInput = document.getElementById('p1-boost-key-input');
const p2FlipKeyInput = document.getElementById('p2-flip-key-input');
const p2BoostKeyInput = document.getElementById('p2-boost-key-input');


const gameContainer1 = document.getElementById('game-container-1');
const gameContainer2 = document.getElementById('game-container-2');
const player1 = document.getElementById('player-1');
const player2 = document.getElementById('player-2');

// --- GAME CONSTANTS ---
const PLAYER_HEIGHT = 30;
const FLOOR_Y = PLAYER_HEIGHT + 5;
const GRAVITY_NORMAL = -0.6;
const GRAVITY_FLIPPED = 0.6;
const JUMP_VELOCITY = 15;
const COLOR_PULSE_DURATION = 750;
const SPEED_INCREASE_RATE = 0.05; // Slower speed increase (was 0.1)
const INTERVAL_DECREASE_RATE = 10; // (was 20)
const PLAYER_X = 100;
const COIN_SPAWN_CHANCE = 0.2;
const MOUSE_COLLECT_SIZE = 1; // Treat mouse as a 1x1 pixel for collision (or change to 10 for a larger hit box)

// --- COIN POSITION CONSTANTS (ADJUSTED FOR SAFE JUMP TRAJECTORY) ---
const COIN_OFFSET_Y = 120;
const COIN_RANGE_Y = 10;
const COIN_HITBOX_PADDING = 15; // Makes collecting coins easier

// --- BOOST CONSTANTS ---
const BOOST_COST = 5;
const BOOST_MULTIPLIER = 2.5;
const BOOST_DURATION = 1500;

// --- KEY BINDINGS (Customizable) ---
let KEY_BINDINGS = {
    P1_FLIP: 'Space',
    P2_FLIP: 'ShiftLeft',
    P1_BOOST: 'KeyE',
    P2_BOOST: 'KeyI'
};

// --- MOUSE STATE (New) ---
// Store the mouse position relative to the viewport.
// Store the mouse position relative to the viewport.
// Store the mouse position relative to the viewport.
let mousePos = { x: 0, y: 0 };
let bgPosX = 0;
let currentSkin = localStorage.getItem('vectorDashSkin') || 'skin-default';




// --- GAME STATE VARIABLES ---
let gameMode = 'single';
let isStarted = false;
let gameLoopId;
let currentlyRemapping = null;

// --- PLAYER STATE ---
let p1 = {
    id: 1, y: FLOOR_Y, vY: 0, gravity: GRAVITY_NORMAL,
    isDead: false, score: 0, coins: 0, isBoosting: false, boostEndTime: 0,
    container: gameContainer1, element: player1, scoreDisplay: document.getElementById('score-display-1')
};
let p2 = {
    id: 2, y: FLOOR_Y, vY: 0, gravity: GRAVITY_NORMAL,
    isDead: false, score: 0, coins: 0, isBoosting: false, boostEndTime: 0,
    container: gameContainer2, element: player2, scoreDisplay: document.getElementById('score-display-2')
};

// --- DIFFICULTY VARIABLES ---
let moveSpeed = 5;
let obstacleInterval = 1500;
let lastObstacleTime = 0;
let keys = {};


// --- MOUSE MOVEMENT LISTENER (New) ---
document.addEventListener('mousemove', (e) => {
    mousePos.x = e.clientX;
    mousePos.y = e.clientY;
});

// --- VISUAL EFFECTS ---
function createPlayerTrail(playerState) {
    if (playerState.isDead) return;

    const trail = document.createElement('div');
    trail.classList.add('player-trail');
    // Match player color/style
    trail.style.backgroundColor = playerState.id === 1 ? '#ff0000' : '#00ccff';
    if (playerState.isBoosting) {
        trail.style.backgroundColor = '#ffffff';
        trail.style.boxShadow = '0 0 10px rgba(255,255,255,0.8)';
    }

    trail.style.left = playerState.element.style.left || '100px';
    trail.style.bottom = playerState.element.style.bottom;

    playerState.container.appendChild(trail);

    // Animate removal
    requestAnimationFrame(() => {
        trail.style.transform = 'scale(0.5)';
        trail.style.opacity = '0';
    });

    setTimeout(() => {
        trail.remove();
    }, 500);
}

function createCoinSparkles(container, x, y) {
    const sparkleCount = 8;
    for (let i = 0; i < sparkleCount; i++) {
        const sparkle = document.createElement('div');
        sparkle.classList.add('coin-sparkle');

        // Random direction
        const angle = Math.random() * Math.PI * 2;
        const dist = 30 + Math.random() * 20;
        const tx = Math.cos(angle) * dist + 'px';
        const ty = Math.sin(angle) * dist + 'px';

        sparkle.style.setProperty('--tx', tx);
        sparkle.style.setProperty('--ty', ty);
        sparkle.style.left = x + 'px';
        sparkle.style.top = y + 'px'; /* Top based on viewport usually, but here relative to container needs care if container is relative. */
        /* Actually our coins are absolute in container. x/y passed are from getBoundingClientRect() which is viewport relative.
           We need to convert to container relative or append to body. Appending to container is safer for scrolling, but position needs adjustment.
           However, the container starts at 0,0 locally usually but let's just append to container and set left/top.
           Since obstacles move left, these particles should technically move left too? 
           For simplicity, let's just spawn them at the fixed capture point. */

        // Fix: Use container usage
        // But getBoundingClientRect returns viewport coordinates. 
        // We need simple coordinates relative to container. 
        // Logic: element was at 'left' style.
        sparkle.style.left = (x - container.getBoundingClientRect().left) + 'px';
        sparkle.style.top = (y - container.getBoundingClientRect().top) + 'px';

        container.appendChild(sparkle);
        setTimeout(() => sparkle.remove(), 800);
    }
}

function showFloatingText(container, text, x, y) {
    const floatText = document.createElement('div');
    floatText.classList.add('floating-text');
    floatText.textContent = text;
    // Adjust pos to container
    floatText.style.left = (x - container.getBoundingClientRect().left) + 'px';
    floatText.style.top = (y - container.getBoundingClientRect().top) + 'px';

    container.appendChild(floatText);
    setTimeout(() => floatText.remove(), 1000);
}


// --- UTILITY FUNCTIONS ---
function clearElements(container, className) {
    container.querySelectorAll(`.${className}`).forEach(el => el.remove());
}

function getGamePlayers() {
    return gameMode === 'single' ? [p1] : [p1, p2];
}

function updateScoreDisplay(playerState) {
    const boostHint = playerState.id === 1 ? `(E: Boost)` : `(I: Boost)`;
    playerState.scoreDisplay.textContent =
        `P${playerState.id} Score: ${Math.floor(playerState.score)} | Coins: ${playerState.coins} ${boostHint}`;
}


// --- MODE SELECTION LISTENERS ---
singlePlayerButton.addEventListener('click', () => {
    gameMode = 'single';
    settingsArea.style.display = 'flex';
    gameContainer1.classList.add('single-player-mode');
    mainContainer.classList.add('single-player-mode');
    gameContainer2.style.display = 'none';
    gameContainer1.style.width = '100vw';
});

twoPlayerButton.addEventListener('click', () => {
    gameMode = 'two';
    settingsArea.style.display = 'flex';
    gameContainer1.classList.remove('single-player-mode');
    mainContainer.classList.remove('single-player-mode');
    gameContainer2.style.display = 'block';
    gameContainer1.style.width = '50vw';
    gameContainer2.style.width = '50vw';
});

// --- SPEED SLIDER LISTENER ---
speedSlider.addEventListener('input', () => {
    const currentSpeed = parseFloat(speedSlider.value).toFixed(1);
    speedValueDisplay.textContent = `Speed: ${currentSpeed}`;
});

// --- FULLSCREEN TOGGLE ---
fullscreenButton.addEventListener('click', () => {
    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        document.documentElement.requestFullscreen();
    }
});

// --- KEY REMAPPING LOGIC ---
const keyInputs = [
    { el: p1FlipKeyInput, binding: 'P1_FLIP' },
    { el: p2FlipKeyInput, binding: 'P2_FLIP' },
    { el: p1BoostKeyInput, binding: 'P1_BOOST' },
    { el: p2BoostKeyInput, binding: 'P2_BOOST' }
];

keyInputs.forEach(input => {
    if (input.el) {
        input.el.addEventListener('click', () => startRemap(input.el, input.binding));
    }
});

function startRemap(inputElement, bindingKey) {
    if (currentlyRemapping) return;

    currentlyRemapping = bindingKey;
    inputElement.value = "Press Key...";
    inputElement.style.backgroundColor = '#ff0000';
    document.addEventListener('keydown', captureKey, { once: true });
}

function captureKey(e) {
    e.preventDefault();
    if (!currentlyRemapping) return;

    const newKey = e.code;
    const inputElement = keyInputs.find(i => i.binding === currentlyRemapping).el;

    if (Object.values(KEY_BINDINGS).includes(newKey)) {
        inputElement.value = "DUPLICATE!";
        setTimeout(() => {
            inputElement.value = KEY_BINDINGS[currentlyRemapping];
            inputElement.style.backgroundColor = '#333';
            currentlyRemapping = null;
        }, 800);
        return;
    }

    KEY_BINDINGS[currentlyRemapping] = newKey;
    inputElement.value = newKey;
    inputElement.style.backgroundColor = '#333';
    currentlyRemapping = null;
}


// --- BOOST HANDLING ---
function handleBoost(playerState, currentTime) {
    if (playerState.isDead || playerState.isBoosting || playerState.coins < BOOST_COST) {
        return;
    }

    playerState.coins -= BOOST_COST;
    playerState.isBoosting = true;
    playerState.boostEndTime = currentTime + BOOST_DURATION;
    playerState.element.classList.add('boosting');
    updateScoreDisplay(playerState);
}


// --- INPUT HANDLING ---
document.addEventListener('keydown', (e) => {
    if (currentlyRemapping) return;
    keys[e.code] = true;

    if (!isStarted) return;

    const currentTime = performance.now();

    // Flip Controls
    if (e.code === KEY_BINDINGS.P1_FLIP && !p1.isDead) {
        handleGravityFlip(p1);
    }
    if (gameMode === 'two' && e.code === KEY_BINDINGS.P2_FLIP && !p2.isDead) {
        handleGravityFlip(p2);
    }

    // Boost Controls
    if (e.code === KEY_BINDINGS.P1_BOOST && !p1.isDead) {
        handleBoost(p1, currentTime);
    }
    if (gameMode === 'two' && e.code === KEY_BINDINGS.P2_BOOST && !p2.isDead) {
        handleBoost(p2, currentTime);
    }
});

document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

function handleGravityFlip(playerState) {
    if (playerState.vY === 0) {
        playerState.gravity = playerState.gravity === GRAVITY_NORMAL ? GRAVITY_FLIPPED : GRAVITY_NORMAL;
        playerState.vY = playerState.gravity > 0 ? JUMP_VELOCITY : -JUMP_VELOCITY;

        playerState.element.style.transform = playerState.gravity === GRAVITY_FLIPPED ? 'rotate(180deg)' : 'rotate(0deg)';

        playerState.container.classList.add('inverted');
        setTimeout(() => {
            playerState.container.classList.remove('inverted');
        }, COLOR_PULSE_DURATION);
    }
}


// --- OBSTACLE & COIN GENERATION ---
// --- OBSTACLE PATTERNS & GENERATION ---
const PATTERNS = {
    SINGLE: 'single',
    TUNNEL: 'tunnel',
    STAIRS: 'stairs',
    GATE: 'gate'
};

let pendingPattern = null;
let patternCount = 0;

function spawnObstacle(container, type, yPos, height, width = 40) {
    const obstacle = document.createElement('div');
    obstacle.classList.add('obstacle');
    if (type === 'floating') obstacle.classList.add('floating');

    obstacle.style.left = container.clientWidth + 'px';
    obstacle.style.width = width + 'px';
    obstacle.style.height = height + 'px';

    if (yPos === 'top') {
        obstacle.style.top = '0px';
    } else if (yPos === 'bottom') {
        obstacle.style.bottom = '0px';
    } else {
        obstacle.style.bottom = yPos + 'px';
    }

    container.appendChild(obstacle);
}

function processPatternGeneration(container) {
    if (!pendingPattern) {
        const difficulty = Math.min(10, Math.floor(moveSpeed / 2));
        const rand = Math.random();

        if (difficulty < 3 || rand < 0.4) pendingPattern = PATTERNS.SINGLE;
        else if (rand < 0.7) pendingPattern = PATTERNS.GATE;
        else if (rand < 0.9) pendingPattern = PATTERNS.STAIRS;
        else pendingPattern = PATTERNS.TUNNEL;

        if (pendingPattern === PATTERNS.SINGLE) patternCount = 1;
        if (pendingPattern === PATTERNS.GATE) patternCount = 1;
        if (pendingPattern === PATTERNS.STAIRS) patternCount = 3;
        if (pendingPattern === PATTERNS.TUNNEL) patternCount = 5;
    }

    const CEILING = container.clientHeight;

    if (pendingPattern === PATTERNS.SINGLE) {
        if (Math.random() < 0.5) spawnObstacle(container, 'normal', 'bottom', 50 + Math.random() * 100);
        else spawnObstacle(container, 'normal', 'top', 50 + Math.random() * 100);
    }
    else if (pendingPattern === PATTERNS.GATE) {
        const safeZone = 170; // Wider safe gap (was 120)
        const center = 100 + Math.random() * (CEILING - 200);
        const topH = CEILING - (center + safeZone / 2);
        const botH = center - safeZone / 2;
        spawnObstacle(container, 'normal', 'top', topH);
        spawnObstacle(container, 'normal', 'bottom', botH);
    }
    else if (pendingPattern === PATTERNS.STAIRS) {
        let h = 50 + (3 - patternCount) * 40;
        spawnObstacle(container, 'normal', 'bottom', h);
    }
    else if (pendingPattern === PATTERNS.TUNNEL) {
        spawnObstacle(container, 'floating', 60 + Math.random() * (CEILING - 150), 30, 80);
    }

    patternCount--;
    if (patternCount <= 0) {
        pendingPattern = null;
    }
}

function createObstacleAndCoin(container) {
    processPatternGeneration(container);

    // 2. COIN SPAWN LOGIC (unchanged logic)
    if (Math.random() < COIN_SPAWN_CHANCE) {
        const coin = document.createElement('div');
        coin.classList.add('coin');
        const coinSize = 20;
        let coinY;
        if (Math.random() < 0.5) {
            coinY = FLOOR_Y + COIN_OFFSET_Y + (Math.random() * COIN_RANGE_Y);
        } else {
            const CEILING_Y = container.clientHeight - coinSize - 5;
            coinY = CEILING_Y - COIN_OFFSET_Y - (Math.random() * COIN_RANGE_Y);
        }
        coin.style.bottom = coinY + 'px';
        coin.style.left = container.clientWidth + 50 + 'px';
        container.appendChild(coin);
    }
}

// --- GAME LOGIC FUNCTIONS ---

function checkMouseCoinCollision(playerState) {
    if (playerState.isDead) return;

    const containerRect = playerState.container.getBoundingClientRect();

    // Check if the mouse is inside this player's container
    if (
        mousePos.x >= containerRect.left && mousePos.x <= containerRect.right &&
        mousePos.y >= containerRect.top && mousePos.y <= containerRect.bottom
    ) {
        // Calculate mouse position relative to the container's coordinates
        const mouseX = mousePos.x;
        const mouseY = mousePos.y;

        playerState.container.querySelectorAll('.coin').forEach(coin => {
            const cRect = coin.getBoundingClientRect();

            // Collision Check between mouse position and coin rectangle
            if (
                mouseX > cRect.left - MOUSE_COLLECT_SIZE && mouseX < cRect.right + MOUSE_COLLECT_SIZE &&
                mouseY > cRect.top - MOUSE_COLLECT_SIZE && mouseY < cRect.bottom + MOUSE_COLLECT_SIZE
            ) {
                playerState.coins += 1;
                updateScoreDisplay(playerState);
                coin.remove();
            }
        });
    }
}


function updatePlayer(playerState, currentTime) {
    if (playerState.isDead) return;

    // Check if boost has ended
    if (playerState.isBoosting && currentTime > playerState.boostEndTime) {
        playerState.isBoosting = false;
        playerState.element.classList.remove('boosting');
    }

    // Physics
    playerState.vY += playerState.gravity;
    playerState.y += playerState.vY;

    // Boundary Check
    const CEILING_Y = playerState.container.clientHeight - (PLAYER_HEIGHT + 5);

    if (playerState.y <= FLOOR_Y) {
        playerState.y = FLOOR_Y;
        playerState.vY = 0;
    }
    if (playerState.y >= CEILING_Y) {
        playerState.y = CEILING_Y;
        playerState.vY = 0;
    }

    // Render
    playerState.element.style.bottom = playerState.y + 'px';

    // Score Update
    const oldScore = Math.floor(playerState.score);
    playerState.score += 0.5;
    updateScoreDisplay(playerState);

    // Difficulty Increase Check
    if (Math.floor(oldScore / 100) !== Math.floor(Math.floor(playerState.score) / 100)) {
        moveSpeed += SPEED_INCREASE_RATE;
        obstacleInterval = Math.max(800, obstacleInterval - INTERVAL_DECREASE_RATE);
    }

    // Collision Check (Obstacles)
    const pRect = playerState.element.getBoundingClientRect();

    playerState.container.querySelectorAll('.obstacle').forEach(obstacle => {
        const oRect = obstacle.getBoundingClientRect();

        if (
            pRect.right > oRect.left && pRect.left < oRect.right &&
            pRect.bottom > oRect.top && pRect.top < oRect.bottom
        ) {
            playerState.isDead = true;
            playerState.container.classList.add('shake'); // Screen Shake
            playerState.container.style.backgroundColor = '#550000'; // Darker red for contrast
        }
    });

    // Collision Check (Coins) - Expanded Hitbox
    playerState.container.querySelectorAll('.coin').forEach(coin => {
        const cRect = coin.getBoundingClientRect();

        if (
            pRect.right + COIN_HITBOX_PADDING > cRect.left &&
            pRect.left - COIN_HITBOX_PADDING < cRect.right &&
            pRect.bottom + COIN_HITBOX_PADDING > cRect.top &&
            pRect.top - COIN_HITBOX_PADDING < cRect.bottom
        ) {
            playerState.coins += 1;
            updateScoreDisplay(playerState);
            createCoinSparkles(playerState.container, cRect.left + 10, cRect.top + 10);
            showFloatingText(playerState.container, "+1", cRect.left, cRect.top);
            coin.remove();
        }
    });

    // NEW: Check Coin Collection with Mouse
    checkMouseCoinCollision(playerState);
}

function updateElements(container, isBoosting) {
    // Determine the current speed based on boost state
    const currentMoveSpeed = isBoosting ? moveSpeed * BOOST_MULTIPLIER : moveSpeed;

    // Scroll Background
    bgPosX -= currentMoveSpeed * 0.1;
    document.body.style.backgroundPosition = `${bgPosX}px center`;

    // Update Obstacles and Coins (Horizontal movement)
    container.querySelectorAll('.obstacle, .coin').forEach(element => {
        let obsX = parseFloat(element.style.left) - currentMoveSpeed;
        element.style.left = obsX + 'px';

        // Remove off-screen elements
        if (obsX < -element.clientWidth) {
            element.remove();
        }
    });
}

function checkGameOver() {
    const players = getGamePlayers();
    let allDead = true;

    for (const player of players) {
        if (!player.isDead) {
            allDead = false;
            break;
        }
    }

    if (allDead) {
        isStarted = false;

        let finalMessage = "GAME OVER";
        if (gameMode === 'single') {
            finalMessage = `Final Score: ${Math.floor(p1.score)} | Coins: ${p1.coins}`;
            if (Math.floor(p1.score) > highScore) {
                highScore = Math.floor(p1.score);
                localStorage.setItem('vectorDashHighScore', highScore);
                highScoreDisplay.textContent = `High Score: ${highScore}`;
                finalMessage += " (NEW HIGH SCORE!)";
            }
        } else {
            const score1 = Math.floor(p1.score);
            const score2 = Math.floor(p2.score);
            const coins1 = p1.coins;
            const coins2 = p2.coins;

            let winner = 'Tie';
            if (score1 > score2) winner = 'P1';
            else if (score2 > score1) winner = 'P2';
            else if (coins1 > coins2) winner = 'P1';
            else if (coins2 > coins1) winner = 'P2';

            if (winner === 'Tie') {
                finalMessage = `Tie Game! (P1: ${score1} pts/${coins1} coins | P2: ${score2} pts/${coins2} coins)`;
            } else {
                finalMessage = `${winner} WINS! P1: ${score1} pts/${coins1} coins | P2: ${score2} pts/${coins2} coins`;
            }
        }

        finalScoreDisplay.textContent = finalMessage;
        restartScreen.style.display = 'flex';
    }
}


// --- MAIN GAME LOOP ---
function gameLoop(currentTime) {
    if (!isStarted) {
        return;
    }

    // Obstacle and Coin Spawning
    if (currentTime - lastObstacleTime > obstacleInterval) {
        createObstacleAndCoin(gameContainer1);
        if (gameMode === 'two') {
            createObstacleAndCoin(gameContainer2);
        }
        lastObstacleTime = currentTime;
    }

    // Update Player 1
    updatePlayer(p1, currentTime);
    updateElements(gameContainer1, p1.isBoosting);
    if (currentTime % 5 < 1) createPlayerTrail(p1); // Spawn trail every few frames

    // Update Player 2 (if active)
    if (gameMode === 'two') {
        updatePlayer(p2, currentTime);
        updateElements(gameContainer2, p2.isBoosting);
        if (currentTime % 5 < 1) createPlayerTrail(p2);
    }

    checkGameOver();

    gameLoopId = requestAnimationFrame(gameLoop);
}


// --- GAME MANAGEMENT ---
startButton.addEventListener('click', () => {
    if (!gameMode) {
        alert("Please select a game mode first!");
        return;
    }
    const baseSpeed = parseFloat(speedSlider.value);
    moveSpeed = baseSpeed;
    obstacleInterval = Math.max(800, 2000 - (baseSpeed * 150));

    startGame();
});

restartButton.addEventListener('click', resetGame);

function startGame() {
    isStarted = true;
    startScreen.style.display = 'none';
    gameLoop(0);
}

function resetGame() {
    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }

    const players = [p1, p2];
    for (const p of players) {
        p.isDead = false;
        p.score = 0;
        p.coins = 0;
        p.y = FLOOR_Y;
        p.vY = 0;
        p.gravity = GRAVITY_NORMAL;
        p.isBoosting = false;
        p.element.classList.remove('boosting');
        p.element.style.transform = 'rotate(0deg)';
        p.container.style.backgroundColor = 'transparent';
        updateScoreDisplay(p);
        clearElements(p.container, 'obstacle');
        clearElements(p.container, 'coin');
        updatePlayerSkin(p);
    }


    moveSpeed = 4; // Slower start speed (was 5)
    obstacleInterval = 1800; // More time between obstacles (was 1500)
    restartScreen.style.display = 'none';
    settingsArea.style.display = 'none';

    // Show the mode selection screen
    startScreen.style.display = 'flex';

    // Update key display inputs
    if (p1FlipKeyInput) p1FlipKeyInput.value = KEY_BINDINGS.P1_FLIP;
    if (p2FlipKeyInput) p2FlipKeyInput.value = KEY_BINDINGS.P2_FLIP;
    if (p1BoostKeyInput) p1BoostKeyInput.value = KEY_BINDINGS.P1_BOOST;
    if (p2BoostKeyInput) p2BoostKeyInput.value = KEY_BINDINGS.P2_BOOST;

    // Reset mode to single player view by default on reset
    gameContainer1.classList.add('single-player-mode');
    mainContainer.classList.add('single-player-mode');
}

// --- SKIN SELECTION LOGIC ---
document.querySelectorAll('.skin-option').forEach(option => {
    option.addEventListener('click', () => {
        // Updated visual selection
        document.querySelectorAll('.skin-option').forEach(o => o.classList.remove('selected'));
        option.classList.add('selected');

        // Update state
        currentSkin = option.getAttribute('data-skin');
        localStorage.setItem('vectorDashSkin', currentSkin);

        // Apply immediately if not playing
        if (!isStarted) {
            updatePlayerSkin(p1);
            // Optional: Player 2 gets the same skin or a variation? For now same.
            updatePlayerSkin(p2);
        }
    });

    // Set initial selection class
    if (option.getAttribute('data-skin') === currentSkin) {
        option.classList.add('selected');
    } else {
        option.classList.remove('selected');
    }
});

function updatePlayerSkin(playerState) {
    // Remove all possible skin classes first
    playerState.element.classList.remove('skin-default', 'skin-neon-blue', 'skin-gold', 'skin-matrix', 'skin-plasma');

    // Add the current selected skin
    // Note: For Player 2 in 2-player mode, we might want a different default, 
    // but the user asked for "choose HIS skin", usually implying the main player.
    // Let's apply the chosen skin to Player 1. 
    // For Player 2 locally, maybe we just use the neon blue one or the same one?
    // Let's apply it to both for now so they match the "team".
    playerState.element.classList.add(currentSkin);
}


// Initialize the game
resetGame();