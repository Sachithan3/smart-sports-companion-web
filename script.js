// ===== SPORTS IMAGES (JS LOOP – WORKING) =====
document.addEventListener("DOMContentLoaded", () => {
    const sportImages = {
        tennis: "images/table-tennis.png",
        football: "images/football.png",
        badminton: "images/badminton.png",
        basketball: "images/basketball.png"
    };

    document.querySelectorAll(".sport-card").forEach(card => {
        const sportKey = card.dataset.sport;

        // Skip cards without a sport key (like Coming Soon ones)
        if (!sportKey || !sportImages[sportKey]) return;

        // Create image element
        const img = document.createElement("img");
        img.src = sportImages[sportKey];
        img.alt = sportKey;
        img.className = "sport-card-image";

        // Debug (VERY useful)
        img.onerror = () => {
            console.error("❌ Image failed to load:", img.src);
        };

        // Insert image at top of card
        card.insertBefore(img, card.firstChild);
    });
});

const navLinks = document.querySelectorAll('.nav-link');
const navbarLinks = document.querySelectorAll('nav .nav-link');
const sections = document.querySelectorAll('.page-section');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetHref = link.getAttribute('href');
        if (!targetHref || !targetHref.startsWith('#')) return;
        
        const targetId = targetHref.substring(1);
        
        // Update active states correctly in Navbar
        navbarLinks.forEach(l => l.classList.remove('active'));
        const correspondingNav = document.querySelector(`nav .nav-link[href="${targetHref}"]`);
        if (correspondingNav) correspondingNav.classList.add('active');
        
        // Show target section with smooth transition
        sections.forEach(section => {
            section.classList.remove('active');
            if (section.id === targetId) {
                section.classList.add('active');
            }
        });
    });
});

// ===== BMI CALCULATOR LOGIC =====
const heightInput = document.getElementById('height');
const weightInput = document.getElementById('weight');
const bmiValueEl = document.getElementById('bmiValue');
const bmiCategoryEl = document.getElementById('bmiCategory');
const bmiBarFill = document.getElementById('bmiBarFill');
const dashBMI = document.getElementById('dashBMI');

function calculateBMI() {
    const height = parseFloat(heightInput.value);
    const weight = parseFloat(weightInput.value);
    
    if (height > 0 && weight > 0) {
        const heightInMeters = height / 100;
        const bmi = (weight / (heightInMeters * heightInMeters)).toFixed(1);
        
        // Update BMI display
        bmiValueEl.textContent = bmi;
        dashBMI.textContent = bmi;
        
        // Determine category and color
        let category, color, barWidth;
        if (bmi < 18.5) {
            category = 'Underweight';
            color = '#4a9eff';
            barWidth = '25%';
        } else if (bmi < 25) {
            category = 'Normal Weight';
            color = '#28c76f';
            barWidth = '50%';
        } else if (bmi < 30) {
            category = 'Overweight';
            color = '#ffa726';
            barWidth = '75%';
        } else {
            category = 'Obese';
            color = '#ff5252';
            barWidth = '100%';
        }
        
        bmiCategoryEl.textContent = category;
        bmiValueEl.style.color = color;
        bmiBarFill.style.width = barWidth;
        bmiBarFill.style.background = `linear-gradient(90deg, ${color}, ${color}dd)`;
    }
}

// Listen for input changes and calculate BMI in real-time
heightInput.addEventListener('input', () => {
    calculateBMI();
    setTimeout(updateBMIIndicator, 10);
});
weightInput.addEventListener('input', () => {
    calculateBMI();
    setTimeout(updateBMIIndicator, 10);
});
calculateBMI(); // Initial calculation on page load

// ===== SPORTS CARD NAVIGATION =====
const gameTitle = document.getElementById("gameTitle");
const gameSubtitle = document.getElementById("gameSubtitle");

document.querySelectorAll('.sport-card').forEach(card => {
    card.addEventListener('click', () => {
        const sport = card.getAttribute('data-sport');
        if (sport === 'tennis' || sport === 'badminton') {
            currentSport = sport;
            
            if (gameTitle) {
                gameTitle.textContent = sport === 'tennis' ? '🏓 Webcam Table Tennis' : '🏸 Webcam Badminton';
            }
            if (gameSubtitle) {
                gameSubtitle.textContent = sport === 'tennis' ? 
                    'Experience motion-controlled table tennis!' : 
                    'Swing your hand to smash the shuttlecock!';
            }
            
            navbarLinks.forEach(l => l.classList.remove('active'));
            const gameLink = document.querySelector('nav .nav-link[href="#game"]');
            if (gameLink) gameLink.classList.add('active');
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById('game').classList.add('active');
            
            // Sync instantiation synchronously if possible, or gracefully handle it
            const gameCanvas = document.getElementById("gameCanvas");
            const ctx = gameCanvas ? gameCanvas.getContext("2d") : null;
            if (sport === 'badminton' && !badmintonGameInstance && gameCanvas && ctx) {
                badmintonGameInstance = new BadmintonGame(gameCanvas, ctx);
            }
            
            if (typeof score !== 'undefined') {
                if (sport === 'tennis') {
                    score = 0;
                    if (typeof resetBall === 'function') resetBall(1);
                }
            }
            if (sport === 'badminton' && badmintonGameInstance) {
                badmintonGameInstance.score = 0;
                badmintonGameInstance.resetBirdie();
            }
            
            // If already streaming, but the user clicks the card, make sure button is hidden
            if (hasWebcamStream && startButton) {
                startButton.style.display = 'none';
                statusText.textContent = "✅ " + (sport === 'tennis' ? "Webcam Table Tennis Active!" : "Webcam Badminton Active!");
            }
        }
    });
});

// ===== GAME LOGIC (MediaPipe Hand Tracking) =====
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js";
import { BadmintonGame } from "./src/games/badminton.js";

let currentSport = 'tennis';
let badmintonGameInstance = null;
let currentLandmarks = null;

const startButton = document.getElementById("startButton");
const statusText = document.getElementById("statusText");
const video = document.getElementById("video");
const gameCanvas = document.getElementById("gameCanvas");
const ctx = gameCanvas.getContext("2d");

let handLandmarker = undefined;
let webcamRunning = false;
let lastVideoTime = -1;

// Game State Variables
let hasWebcamStream = false;
let playerTargetY = gameCanvas.height / 2;
let previousSmoothedY = gameCanvas.height / 2;
let handVisible = false;
let lastDetectionY = gameCanvas.height / 2;
let lastDetectionTimestamp = 0;
let detectionVelocityY = 0;
const trackingGraceMs = 140;
const predictionDamping = 0.88;

const paddleWidth = 12;
const paddleHeight = 70;
const ballRadius = 7;
const maxPaddleSpeedPerFrame = 24;

let playerY = gameCanvas.height / 2 - paddleHeight / 2;
let playerVelocity = 0;
let playerPaddleVelocity = 0;
let aiY = gameCanvas.height / 2 - paddleHeight / 2;

let ballX = gameCanvas.width / 2;
let ballY = gameCanvas.height / 2;
let ballSpeedX = 2.6;
let ballSpeedY = 1.1;
let ballCurrentSpeed = 2.8;
const ballBaseSpeed = 2.8;
const ballAccelerationPerSecond = 0.18;
const ballMaxSpeed = 11;
let lastPaddleCollisionMs = 0;
const paddleCollisionCooldownMs = 55;
const ballTrail = [];
const particles = [];

let score = 0;
let highScore = 0;
let isRunning = false;
let lastFrameTime = performance.now();
let lastAIDecisionTime = performance.now();
let aiTargetY = aiY + paddleHeight / 2;
let aiReactionDelayMs = 150;
const aiDifficulty = {
    maxSpeed: 6.2,
    predictionError: 12
};

let screenShakeAmount = 0;
let screenShakeDecay = 0.9;

// Initialize MediaPipe
async function createHandLandmarker() {
    const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm"
    );
    handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
    });
    
    // Enable start button
    if (startButton) {
        startButton.disabled = false;
        startButton.textContent = "🚀 Start Game (Allow Webcam)";
        statusText.textContent = "Click the button to request webcam access.";
    }
}
createHandLandmarker();

// Request webcam access and start video stream
async function startWebcam() {
    try {
        statusText.textContent = "Requesting webcam access...";
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 60, max: 60 },
                facingMode: "user"
            },
            audio: false,
        });
        video.srcObject = stream;
        hasWebcamStream = true;
        
        video.addEventListener("playing", () => {
            if (startButton) startButton.style.display = 'none';
            statusText.textContent = currentSport === 'tennis' 
                ? "✅ Webcam started! Raise your hand to play table tennis."
                : "✅ Webcam started! Raise your hand to play badminton.";
                
            if (!isRunning) {
                isRunning = true;
                if (currentSport === 'tennis') {
                    resetBall(1);
                } else if (currentSport === 'badminton' && badmintonGameInstance) {
                    badmintonGameInstance.resetBirdie();
                }
                lastFrameTime = performance.now();
                lastAIDecisionTime = lastFrameTime;
                requestAnimationFrame(gameLoop);
            }
        });
    } catch (err) {
        console.error("Error accessing webcam:", err);
        statusText.textContent = "❌ Could not access webcam. Please allow camera permission and try again.";
    }
}

function spawnParticles(x, y, count = 10) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3 + 1;
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            color: Math.random() > 0.5 ? '#ffce54' : '#ffffff'
        });
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.05;
        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

// Reset ball position after scoring
function resetBall(directionX = 1) {
    ballX = gameCanvas.width / 2;
    ballY = gameCanvas.height / 2;
    ballCurrentSpeed = ballBaseSpeed;
    const launchAngle = (Math.random() * 0.55 - 0.275);
    ballSpeedX = Math.cos(launchAngle) * ballCurrentSpeed * directionX;
    ballSpeedY = Math.sin(launchAngle) * ballCurrentSpeed;
    lastPaddleCollisionMs = 0;
    ballTrail.length = 0;
}

function normalizeBallSpeed(targetSpeed) {
    const totalSpeed = Math.hypot(ballSpeedX, ballSpeedY) || 1;
    const scale = targetSpeed / totalSpeed;
    ballSpeedX *= scale;
    ballSpeedY *= scale;
}

function updatePlayerPaddle(dt) {
    if (!hasWebcamStream) return;

    // Limit paddle travel per frame to avoid teleports on detection reacquire.
    const targetTop = Math.max(0, Math.min(gameCanvas.height - paddleHeight, playerTargetY - paddleHeight / 2));
    const delta = targetTop - playerY;

    const responsiveness = handVisible ? 0.62 : 0.35;
    let desiredStep = delta * responsiveness;
    const maxStep = maxPaddleSpeedPerFrame * dt * (handVisible ? 1.35 : 1.0);
    desiredStep = Math.max(-maxStep, Math.min(maxStep, desiredStep));

    playerY += desiredStep;
    
    playerY = Math.max(0, Math.min(gameCanvas.height - paddleHeight, playerY));
    playerPaddleVelocity = desiredStep;
}

// AI paddle with reaction delay, prediction error and speed cap
function updateAI(dt, nowMs) {
    if (nowMs - lastAIDecisionTime >= aiReactionDelayMs) {
        let projectedY = ballY;
        if (ballSpeedX > 0) {
            const distanceToAI = (gameCanvas.width - paddleWidth - ballRadius) - ballX;
            const framesToReach = Math.max(0, distanceToAI / Math.max(0.001, ballSpeedX));
            projectedY += ballSpeedY * Math.min(framesToReach, 45);
        }

        const error = (Math.random() * 2 - 1) * aiDifficulty.predictionError;
        projectedY += error;
        aiTargetY = Math.max(paddleHeight / 2, Math.min(gameCanvas.height - paddleHeight / 2, projectedY));
        aiReactionDelayMs = 100 + Math.random() * 100;
        lastAIDecisionTime = nowMs;
    }

    const aiCenter = aiY + paddleHeight / 2;
    const delta = aiTargetY - aiCenter;
    const maxStep = aiDifficulty.maxSpeed * dt;
    aiY += Math.max(-maxStep, Math.min(maxStep, delta));
    aiY = Math.max(0, Math.min(gameCanvas.height - paddleHeight, aiY));
}

function applyPaddleCollision(isPlayer, nowMs) {
    const paddleTop = isPlayer ? playerY : aiY;
    const paddleCenter = paddleTop + paddleHeight / 2;
    const hit = (ballY - paddleCenter) / (paddleHeight / 2);
    const clampedHit = Math.max(-1, Math.min(1, hit));
    const paddleVelocity = isPlayer ? playerPaddleVelocity : 0;

    ballSpeedY += clampedHit * 4;
    ballSpeedY += paddleVelocity * 0.3;
    ballSpeedY += (Math.random() * 2 - 1) * 0.18;
    ballSpeedX *= -1.05;

    ballCurrentSpeed = Math.min(ballMaxSpeed, Math.max(ballBaseSpeed, Math.hypot(ballSpeedX, ballSpeedY)));
    normalizeBallSpeed(ballCurrentSpeed);

    if (isPlayer) {
        ballX = paddleWidth + ballRadius + 0.5;
        score++;
        highScore = Math.max(highScore, score);
    } else {
        ballX = gameCanvas.width - paddleWidth - ballRadius - 0.5;
    }

    lastPaddleCollisionMs = nowMs;
    screenShakeAmount = 4;
    
    spawnParticles(ballX, ballY, 15);
}

function ballIntersectsPaddle(isPlayer) {
    const paddleTop = isPlayer ? playerY : aiY;
    const paddleLeft = isPlayer ? 0 : gameCanvas.width - paddleWidth;
    const paddleRight = paddleLeft + paddleWidth;
    const withinY = ballY + ballRadius >= paddleTop && ballY - ballRadius <= paddleTop + paddleHeight;
    const withinX = ballX + ballRadius >= paddleLeft && ballX - ballRadius <= paddleRight;
    return withinX && withinY;
}

// Update ball position with acceleration, cooldown collision and anti-tunneling
function updateBall(dt, nowMs) {
    ballCurrentSpeed = Math.min(ballMaxSpeed, ballCurrentSpeed + ballAccelerationPerSecond * dt);
    normalizeBallSpeed(ballCurrentSpeed);

    const steps = Math.max(1, Math.ceil(Math.hypot(ballSpeedX, ballSpeedY) * dt / (ballRadius * 0.7)));
    const stepDt = dt / steps;
    const canCollideWithPaddle = nowMs - lastPaddleCollisionMs > paddleCollisionCooldownMs;

    for (let step = 0; step < steps; step++) {
        ballX += ballSpeedX * stepDt;
        ballY += ballSpeedY * stepDt;

        if (ballY - ballRadius < 0 && ballSpeedY < 0) {
            ballY = ballRadius;
            ballSpeedY *= -1;
            ballSpeedY *= 1 + (Math.random() * 0.1 - 0.05);
            normalizeBallSpeed(ballCurrentSpeed);
            spawnParticles(ballX, ballY, 5);
        }

        if (ballY + ballRadius > gameCanvas.height && ballSpeedY > 0) {
            ballY = gameCanvas.height - ballRadius;
            ballSpeedY *= -1;
            ballSpeedY *= 1 + (Math.random() * 0.1 - 0.05);
            normalizeBallSpeed(ballCurrentSpeed);
            spawnParticles(ballX, ballY, 5);
        }

        if (canCollideWithPaddle && ballSpeedX < 0 && ballIntersectsPaddle(true)) {
            applyPaddleCollision(true, nowMs);
            break;
        }

        if (canCollideWithPaddle && ballSpeedX > 0 && ballIntersectsPaddle(false)) {
            applyPaddleCollision(false, nowMs);
            break;
        }
    }

    if (ballX < 0) {
        score = 0;
        screenShakeAmount = 8;
        resetBall(1);
    }

    if (ballX > gameCanvas.width) {
        screenShakeAmount = 8;
        resetBall(-1);
    }

    ballTrail.push({ x: ballX, y: ballY, life: 1 });
    if (ballTrail.length > 10) {
        ballTrail.shift();
    }
    for (let i = 0; i < ballTrail.length; i++) {
        ballTrail[i].life *= 0.84;
    }
}

// Draw the game scene
function drawGame() {
    screenShakeAmount *= screenShakeDecay;
    const shakeX = screenShakeAmount > 0.1 ? (Math.random() * 2 - 1) * screenShakeAmount : 0;
    const shakeY = screenShakeAmount > 0.1 ? (Math.random() * 2 - 1) * screenShakeAmount : 0;

    ctx.save();
    ctx.translate(shakeX, shakeY);
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

    ctx.strokeStyle = "#3e4370";
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.moveTo(gameCanvas.width / 2, 0);
    ctx.lineTo(gameCanvas.width / 2, gameCanvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1.0;

    // Draw Paddles
    ctx.fillStyle = "#f5f5f5";
    if (hasWebcamStream && handLandmarker) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = "#4a9eff";
    }
    ctx.fillRect(0, playerY, paddleWidth, paddleHeight);
    
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(gameCanvas.width - paddleWidth, aiY, paddleWidth, paddleHeight);

    for (let i = 0; i < ballTrail.length; i++) {
        const t = ballTrail[i];
        ctx.beginPath();
        ctx.arc(t.x, t.y, ballRadius * (0.45 + t.life * 0.35), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 206, 84, ${t.life * 0.22})`;
        ctx.fill();
    }

    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ffce54";
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffce54";
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(score.toString(), gameCanvas.width / 4, 35);
    ctx.fillText(highScore.toString(), (gameCanvas.width * 3) / 4, 35);

    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#c4c7ff";
    ctx.fillText("SCORE", gameCanvas.width / 4, 52);
    ctx.fillText("HIGH", (gameCanvas.width * 3) / 4, 52);
    ctx.restore();
}

// Main game loop
async function gameLoop(timestamp) {
    if (!isRunning) return;

    let gotFreshDetection = false;

    if (handLandmarker && video.readyState >= 2) {
        if (lastVideoTime !== video.currentTime) {
            lastVideoTime = video.currentTime;
            const results = handLandmarker.detectForVideo(video, performance.now());
            if (results.landmarks && results.landmarks.length > 0) {
                currentLandmarks = results.landmarks;
                const indexFingerTip = results.landmarks[0][8];
                const wrist = results.landmarks[0][0];
                const rawY = ((indexFingerTip.y * 0.65) + (wrist.y * 0.35)) * gameCanvas.height;

                if (lastDetectionTimestamp > 0) {
                    const framesElapsed = Math.max(1, (timestamp - lastDetectionTimestamp) / 16.67);
                    const instantVelocity = (rawY - lastDetectionY) / framesElapsed;
                    detectionVelocityY = detectionVelocityY * 0.55 + instantVelocity * 0.45;
                }

                playerTargetY = rawY;
                lastDetectionY = rawY;
                lastDetectionTimestamp = timestamp;
                handVisible = true;
                gotFreshDetection = true;
            }
        }
    }

    if (!gotFreshDetection) {
        const msSinceDetection = lastDetectionTimestamp > 0 ? (timestamp - lastDetectionTimestamp) : Number.POSITIVE_INFINITY;

        if (msSinceDetection <= trackingGraceMs) {
            const framesSinceDetection = msSinceDetection / 16.67;
            const dampedVelocity = detectionVelocityY * Math.pow(predictionDamping, framesSinceDetection);
            playerTargetY = lastDetectionY + dampedVelocity * framesSinceDetection;
            playerTargetY = Math.max(0, Math.min(gameCanvas.height, playerTargetY));
            handVisible = true;
        } else {
            handVisible = false;
            detectionVelocityY *= 0.85;
            currentLandmarks = null;
        }
    }

    const dtMs = timestamp - lastFrameTime;
    const dt = Math.min(2.4, Math.max(0.5, dtMs / 16.67));
    lastFrameTime = timestamp;

    if (currentSport === 'tennis') {
        updatePlayerPaddle(dt);
        updateAI(dt, timestamp);
        updateBall(dt, timestamp);
        updateParticles();
        drawGame();
    } else if (currentSport === 'badminton' && badmintonGameInstance) {
        badmintonGameInstance.update(currentLandmarks, dtMs, timestamp);
        badmintonGameInstance.draw();
    }
    
    requestAnimationFrame(gameLoop);
}

if (startButton) {
    startButton.addEventListener("click", async () => {
        if (!hasWebcamStream) {
            await startWebcam();
        }
    });
}

drawGame();

// ===== HOME DASHBOARD - ACTIVITY CALENDAR =====
const homeCalendarHeatmap = document.getElementById('homeCalendarHeatmap');
const homeCalendarMonthLabels = document.getElementById('homeCalendarMonthLabels');
const activityModal = document.getElementById('activityModal');
const activityDate = document.getElementById('activityDate');
const activityContent = document.getElementById('activityContent');
const closeModal = document.getElementById('closeModal');

// Generate mock activity data
function generateMockActivityData() {
    const activities = {};
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    
    const sports = ['Table Tennis', 'Football', 'Badminton', 'Basketball', 'Running'];
    const notes = [
        'Great session today',
        'Focused on technique',
        'Played with friends',
        'Intense workout',
        'Casual practice',
        'Training session',
        'Quick match',
        null
    ];
    
    // Generate activities for random days
    for (let i = 0; i < 365; i++) {
        const date = new Date(oneYearAgo);
        date.setDate(date.getDate() + i);
        
        // 30% chance of activity on any given day
        if (Math.random() < 0.3) {
            const dateKey = date.toISOString().split('T')[0];
            const activityCount = Math.floor(Math.random() * 3) + 1; // 1-3 activities per day
            
            activities[dateKey] = [];
            for (let j = 0; j < activityCount; j++) {
                activities[dateKey].push({
                    sport: sports[Math.floor(Math.random() * sports.length)],
                    duration: Math.floor(Math.random() * 60) + 15 + ' minutes',
                    notes: notes[Math.floor(Math.random() * notes.length)]
                });
            }
        }
    }
    
    return activities;
}

const mockActivityData = generateMockActivityData();

// Update BMI indicator position
function updateBMIIndicator() {
    const bmiValue = parseFloat(document.getElementById('dashBMI').textContent);
    const bmiIndicator = document.getElementById('bmiIndicator');
    const bmiStatusValue = document.getElementById('bmiStatusValue');
    
    if (!bmiIndicator || !bmiStatusValue) return;
    
    bmiStatusValue.textContent = bmiValue;
    
    // Calculate position (BMI range 0-40 mapped to 0-100%)
    // Segments: Underweight (0-18.5) = 18.5%, Normal (18.5-25) = 25%, Overweight (25-30) = 30%, Obese (30-40) = 26.5%
    let position = 0;
    if (bmiValue < 18.5) {
        // Underweight: 0-18.5 maps to 0-18.5%
        position = (bmiValue / 18.5) * 18.5;
    } else if (bmiValue < 25) {
        // Normal: 18.5-25 maps to 18.5-43.5%
        position = 18.5 + ((bmiValue - 18.5) / (25 - 18.5)) * 25;
    } else if (bmiValue < 30) {
        // Overweight: 25-30 maps to 43.5-73.5%
        position = 43.5 + ((bmiValue - 25) / (30 - 25)) * 30;
    } else {
        // Obese: 30-40 maps to 73.5-100%
        position = 73.5 + Math.min(((bmiValue - 30) / 10) * 26.5, 26.5);
    }
    
    // Clamp to 0-100%
    position = Math.max(0, Math.min(100, position));
    bmiIndicator.style.left = `${position}%`;
}

// Update calories progress
function updateCaloriesProgress() {
    const caloriesValue = document.getElementById('caloriesValue');
    const caloriesProgress = document.getElementById('caloriesProgress');
    
    if (!caloriesValue || !caloriesProgress) return;
    
    const current = 1240;
    const goal = 2000;
    const percentage = Math.min((current / goal) * 100, 100);
    
    caloriesProgress.style.width = `${percentage}%`;
    
    // Update color based on progress
    if (percentage < 50) {
        caloriesProgress.style.background = 'rgba(255, 167, 38, 0.7)';
    } else if (percentage < 100) {
        caloriesProgress.style.background = 'linear-gradient(90deg, #ffa726, #ffb74d)';
    } else {
        caloriesProgress.style.background = 'linear-gradient(90deg, #28c76f, #48da89)';
    }
}

// Generate calendar heatmap
function generateCalendarHeatmap() {
    if (!homeCalendarHeatmap) return;
    
    const today = new Date();
    const oneYearAgo = new Date(today);
    oneYearAgo.setFullYear(today.getFullYear() - 1);
    oneYearAgo.setDate(oneYearAgo.getDate() - oneYearAgo.getDay()); // Start from Sunday
    
    const weeks = [];
    let currentDate = new Date(oneYearAgo);
    const endDate = new Date(today);
    
    // Generate weeks
    while (currentDate <= endDate) {
        const week = [];
        for (let i = 0; i < 7; i++) {
            if (currentDate > endDate) break;
            
            const dateKey = currentDate.toISOString().split('T')[0];
            const activities = mockActivityData[dateKey] || [];
            const intensity = Math.min(4, activities.length);
            
            week.push({
                date: new Date(currentDate),
                dateKey: dateKey,
                activities: activities,
                intensity: intensity
            });
            
            currentDate.setDate(currentDate.getDate() + 1);
        }
        if (week.length > 0) {
            weeks.push(week);
        }
    }
    
    // Render calendar
    homeCalendarHeatmap.innerHTML = '';
    const totalWeeks = weeks.length;
    
    // Update grid to match number of weeks
    homeCalendarHeatmap.style.gridTemplateColumns = `repeat(${totalWeeks}, 1fr)`;
    
    // Flatten weeks array and render all days
    weeks.forEach((week) => {
        week.forEach((day) => {
            const dayEl = document.createElement('div');
            dayEl.className = 'calendar-day';
            dayEl.setAttribute('data-intensity', day.intensity);
            dayEl.setAttribute('data-date', day.dateKey);
            
            if (day.activities.length > 0) {
                dayEl.classList.add('has-activity');
            }
            
            // Tooltip
            const dateStr = day.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            const activityCount = day.activities.length;
            dayEl.title = `${dateStr}: ${activityCount} ${activityCount === 1 ? 'activity' : 'activities'}`;
            
            dayEl.addEventListener('click', () => showActivityModal(day.dateKey, day.activities, day.date));
            homeCalendarHeatmap.appendChild(dayEl);
        });
    });
    
    // Generate month labels
    generateMonthLabels(weeks);
}

// Generate month labels
function generateMonthLabels(weeks) {
    if (!homeCalendarMonthLabels) return;
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthPositions = {};
    
    // Find first occurrence of each month (check first day of each week)
    weeks.forEach((week, weekIndex) => {
        if (week.length > 0) {
            const firstDay = week[0];
            const month = firstDay.date.getMonth();
            if (!(month in monthPositions)) {
                monthPositions[month] = weekIndex;
            }
        }
    });
    
    // Render month labels
    homeCalendarMonthLabels.innerHTML = '';
    const sortedMonths = Object.keys(monthPositions).sort((a, b) => monthPositions[a] - monthPositions[b]);
    const totalWeeks = weeks.length;
    
    sortedMonths.forEach(month => {
        const weekIndex = monthPositions[month];
        const label = document.createElement('span');
        label.textContent = months[month];
        const leftPercent = (weekIndex / totalWeeks) * 100;
        label.style.left = `calc(${leftPercent}% + 2px)`;
        homeCalendarMonthLabels.appendChild(label);
    });
}

// Show activity modal for selected date
function showActivityModal(dateKey, activities, date) {
    if (!activityModal || !activityDate || !activityContent) return;
    
    const dateStr = date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    activityDate.textContent = dateStr;
    
    if (activities.length === 0) {
        activityContent.innerHTML = '<div class="activity-empty">No activities recorded for this date.</div>';
    } else {
        activityContent.innerHTML = activities.map((activity) => {
            // Calculate calories (mock: ~10 calories per minute)
            const minutes = parseInt(activity.duration);
            const calories = minutes * 10;
            
            return `
                <div class="activity-item">
                    <div class="activity-item-header">
                        <span class="activity-sport">${activity.sport}</span>
                        <span class="activity-duration">${activity.duration}</span>
                    </div>
                    <div class="activity-calories">Calories burned: ${calories}</div>
                    ${activity.notes ? `<div class="activity-notes">${activity.notes}</div>` : ''}
                </div>
            `;
        }).join('');
    }
    
    activityModal.classList.remove('hidden');
}

// Close activity modal
if (closeModal) {
    closeModal.addEventListener('click', () => {
        if (activityModal) {
            activityModal.classList.add('hidden');
        }
    });
}

// Close modal when clicking outside
if (activityModal) {
    activityModal.addEventListener('click', (e) => {
        if (e.target === activityModal) {
            activityModal.classList.add('hidden');
        }
    });
}

// Initialize calendar on homepage
function initCalendar() {
    if (homeCalendarHeatmap && homeCalendarHeatmap.children.length === 0) {
        generateCalendarHeatmap();
    }
}

// Initialize calendar and progress bars when home section is active
const homeSection = document.getElementById('home');
if (homeSection) {
    // Initialize on page load if home is active
    if (homeSection.classList.contains('active')) {
        initCalendar();
        updateBMIIndicator();
        updateCaloriesProgress();
    }
    
    // Initialize when home section becomes active
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (homeSection.classList.contains('active')) {
                    initCalendar();
                    updateBMIIndicator();
                    updateCaloriesProgress();
                }
            }
        });
    });
    
    observer.observe(homeSection, { attributes: true });
}

// Update BMI indicator when BMI changes
if (dashBMI) {
    const bmiObserver = new MutationObserver(() => {
        updateBMIIndicator();
    });
    bmiObserver.observe(dashBMI, { childList: true, characterData: true });
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    initCalendar();
    updateBMIIndicator();
    updateCaloriesProgress();
});
