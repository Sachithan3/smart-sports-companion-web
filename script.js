// ===== SPORTS IMAGES (JS LOOP – WORKING) =====
document.addEventListener("DOMContentLoaded", () => {
    const sportImages = {
        tennis: "images/table-tennis.png",
        boxing: "images/boxing.png",
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

// Load saved BMI data
const savedHeight = localStorage.getItem('userHeight');
const savedWeight = localStorage.getItem('userWeight');
if (savedHeight && heightInput) heightInput.value = savedHeight;
if (savedWeight && weightInput) weightInput.value = savedWeight;

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

        // Persist BMI data
        localStorage.setItem('userHeight', height);
        localStorage.setItem('userWeight', weight);
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
const gameHint = document.querySelector(".game-hint");

// ===== GAME LOGIC (MediaPipe Hand Tracking) =====
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js";
import { TableTennisGame3D } from "./src/games/tableTennis3d.js";
import { BadmintonGame } from "./src/games/badminton.js";
import { Badminton3D } from "./src/games/badminton3D.js";
import { BoxingGame } from "./src/games/boxing.js";

let currentSport = 'tennis';
let tennisGame3DInstance = null;
let badmintonGameInstance = null;
let badminton3DInstance = null;
let boxingGameInstance = null;
let activeGameInstance = null;
let currentTracking = { hands: null };

const startButton = document.getElementById("startButton");
const statusText = document.getElementById("statusText");
const video = document.getElementById("video");
const trackingOverlay = document.getElementById("trackingOverlay");
const gameCanvas = document.getElementById("gameCanvas");
const rallyScoreEl = document.getElementById("rallyScore");
const highScoreEl = document.getElementById("highScore");
const missCountEl = document.getElementById("missCount");

let handLandmarker = undefined;
let lastVideoTime = -1;

// Game State Variables
let hasWebcamStream = false;
let handVisible = false;
let lastDetectionY = gameCanvas.height / 2;
let lastDetectionTimestamp = 0;
let detectionVelocityY = 0;
let playerTargetY = lastDetectionY;
const trackingGraceMs = 140;
const predictionDamping = 0.88;

let score = 0;
let highScore = 0;
let isRunning = false;
let lastFrameTime = performance.now();
const SPORT_MET = {
    tennis: 4.0,
    boxing: 7.0,
    badminton: 5.5
};
const SPORT_LABEL = {
    tennis: 'Table Tennis',
    boxing: 'Boxing',
    badminton: 'Badminton'
};
const SESSION_WEIGHT_KG = 70;
const CALORIE_DISPLAY_SCALE = 0.05;
const CALORIES_GOAL = 2000;
const DAILY_CALORIES_KEY = 'sportsCompDailyCalories';
const MANUAL_CAL_LOG_KEY = 'sportsCompManualCaloriesLog';
const DEFAULT_DAILY_CALORIES = 450;
const CALORIE_RESET_V2_KEY = 'sportsCompCalorieResetV2';
const SPORT_HIGHSCORE_KEYS = {
    tennis: 'sportsCompHighScoreTennis',
    boxing: 'sportsCompHighScoreBoxing',
    badminton: 'sportsCompHighScoreBadminton'
};
const savedDailyCalories = Number(localStorage.getItem(DAILY_CALORIES_KEY));
let dailyCaloriesBurned = Number.isFinite(savedDailyCalories) && savedDailyCalories > 0 ? savedDailyCalories : DEFAULT_DAILY_CALORIES;
if (!Number.isFinite(savedDailyCalories) || savedDailyCalories === 1240) {
    dailyCaloriesBurned = DEFAULT_DAILY_CALORIES;
    localStorage.setItem(DAILY_CALORIES_KEY, String(DEFAULT_DAILY_CALORIES));
}
let sportHighScores = {
    tennis: Math.max(0, Number(localStorage.getItem(SPORT_HIGHSCORE_KEYS.tennis)) || 0),
    boxing: Math.max(0, Number(localStorage.getItem(SPORT_HIGHSCORE_KEYS.boxing)) || 0),
    badminton: Math.max(0, Number(localStorage.getItem(SPORT_HIGHSCORE_KEYS.badminton)) || 0)
};
const sessionState = {
    isActive: false,
    startTimeMs: null,
    sport: null,
    calories: 0,
    durationSeconds: 0
};
let manualCaloriesLog = (() => {
    const saved = localStorage.getItem(MANUAL_CAL_LOG_KEY);
    if (!saved) return [];
    try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
})();

if (localStorage.getItem(CALORIE_RESET_V2_KEY) !== 'done') {
    dailyCaloriesBurned = DEFAULT_DAILY_CALORIES;
    manualCaloriesLog = [];
    localStorage.setItem(DAILY_CALORIES_KEY, String(DEFAULT_DAILY_CALORIES));
    localStorage.setItem(MANUAL_CAL_LOG_KEY, JSON.stringify([]));
    localStorage.setItem(CALORIE_RESET_V2_KEY, 'done');
}

function getSportLabel(sport) {
    return SPORT_LABEL[sport] || 'Workout';
}

function resetSessionStateForSport(sport) {
    sessionState.isActive = false;
    sessionState.startTimeMs = null;
    sessionState.sport = sport;
    sessionState.calories = 0;
    sessionState.durationSeconds = 0;
}

function updateStartButtonState() {
    if (!startButton) return;
    startButton.style.display = 'block';
    startButton.style.visibility = 'visible';
    startButton.style.opacity = '1';
    startButton.disabled = false;

    if (!hasWebcamStream) {
        startButton.textContent = "🚀 Start Game (Allow Webcam)";
        return;
    }
    startButton.textContent = sessionState.isActive ? "🛑 End Session" : "▶ Start Session";
}

function updateHomeHighScoresDisplay() {
    const tennisEl = document.getElementById('homeHighTennis');
    const boxingEl = document.getElementById('homeHighBoxing');
    const badmintonEl = document.getElementById('homeHighBadminton');
    if (tennisEl) tennisEl.textContent = String(sportHighScores.tennis || 0);
    if (boxingEl) boxingEl.textContent = String(sportHighScores.boxing || 0);
    if (badmintonEl) badmintonEl.textContent = String(sportHighScores.badminton || 0);
}

function renderManualCaloriesLog() {
    const listEl = document.getElementById('manualCaloriesList');
    if (!listEl) return;
    if (!manualCaloriesLog.length) {
        listEl.innerHTML = '<div class="manual-calorie-item"><span class="manual-calorie-amount">0 cal</span><span class="manual-calorie-note">No manual entries yet.</span></div>';
        return;
    }
    listEl.innerHTML = manualCaloriesLog
        .slice()
        .reverse()
        .map((item) => `
            <div class="manual-calorie-item">
                <span class="manual-calorie-amount">+${item.calories} cal</span>
                <span class="manual-calorie-note">${item.note}</span>
            </div>
        `).join('');
}

function addManualCaloriesEntry() {
    const caloriesInput = document.getElementById('manualCaloriesInput');
    const noteInput = document.getElementById('manualCaloriesNote');
    if (!caloriesInput || !noteInput) return;

    const calories = Math.round(Number(caloriesInput.value));
    const note = String(noteInput.value || '').trim();
    if (!Number.isFinite(calories) || calories <= 0 || !note) return;

    manualCaloriesLog.push({ calories, note });
    localStorage.setItem(MANUAL_CAL_LOG_KEY, JSON.stringify(manualCaloriesLog));

    dailyCaloriesBurned += calories;
    localStorage.setItem(DAILY_CALORIES_KEY, String(dailyCaloriesBurned));
    updateCaloriesProgress();
    renderManualCaloriesLog();

    caloriesInput.value = '';
    noteInput.value = '';
}

function persistHighScoreForSport(sportKey, value) {
    if (!sportKey || !Object.prototype.hasOwnProperty.call(sportHighScores, sportKey)) return;
    const nextValue = Math.max(0, Number(value) || 0);
    if (nextValue <= sportHighScores[sportKey]) return;
    sportHighScores[sportKey] = nextValue;
    localStorage.setItem(SPORT_HIGHSCORE_KEYS[sportKey], String(nextValue));
    updateHomeHighScoresDisplay();
}

function startSession() {
    resetSessionStateForSport(currentSport);
    sessionState.isActive = true;
    sessionState.startTimeMs = Date.now();
    updateStartButtonState();
    if (statusText) {
        statusText.textContent = `✅ ${getSportLabel(currentSport)} session started. Click "End Session" when done.`;
    }
}

function endSession(reason = 'manual-end') {
    if (!sessionState.isActive || !sessionState.startTimeMs) return null;

    const endTimeMs = Date.now();
    const rawDurationSec = Math.floor((endTimeMs - sessionState.startTimeMs) / 1000);
    const durationSeconds = Math.max(1, Number.isFinite(rawDurationSec) ? rawDurationSec : 1);
    const durationHours = durationSeconds / 3600;
    const metValue = SPORT_MET[sessionState.sport] ?? SPORT_MET[currentSport] ?? 4.0;
    const actualCalories = metValue * SESSION_WEIGHT_KG * durationHours;
    const displayCaloriesRaw = actualCalories * CALORIE_DISPLAY_SCALE;
    let displayCalories = Math.round(displayCaloriesRaw);
    if (durationSeconds >= 5 && displayCalories === 0) displayCalories = 1;

    sessionState.durationSeconds = durationSeconds;
    sessionState.calories = Math.max(0, Number.isFinite(displayCalories) ? displayCalories : 0);
    sessionState.isActive = false;
    sessionState.startTimeMs = null;

    dailyCaloriesBurned += sessionState.calories;
    localStorage.setItem(DAILY_CALORIES_KEY, String(dailyCaloriesBurned));
    updateCaloriesProgress();

    const minutes = Math.floor(durationSeconds / 60);
    const seconds = durationSeconds % 60;
    const durationLabel = `${minutes}m ${seconds}s`;
    const sportLabel = getSportLabel(sessionState.sport || currentSport);

    logActivity({
        sport: sportLabel,
        duration: durationLabel,
        durationSeconds,
        calories: sessionState.calories,
        notes: `Completed ${sportLabel} session`,
        reason
    });

    if (statusText) {
        statusText.textContent = `🏁 Ended ${sportLabel} (${durationLabel}) • Calories: ${sessionState.calories}`;
    }
    updateStartButtonState();
    return { durationSeconds, durationLabel, sportLabel, calories: sessionState.calories };
}

function createActiveGameForSport(sport) {
    if (!gameCanvas) return;
    if (activeGameInstance && typeof activeGameInstance.destroy === 'function') {
        activeGameInstance.destroy();
    }
    if (sport === 'tennis') {
        tennisGame3DInstance = new TableTennisGame3D(gameCanvas);
        activeGameInstance = tennisGame3DInstance;
    } else if (sport === 'badminton') {
        badminton3DInstance = new Badminton3D(gameCanvas);
        badmintonGameInstance = badminton3DInstance;
        activeGameInstance = badminton3DInstance;
    } else if (sport === 'boxing') {
        boxingGameInstance = new BoxingGame(gameCanvas);
        activeGameInstance = boxingGameInstance;
    }
}

function resetCurrentGame() {
    if (currentSport === 'tennis' && tennisGame3DInstance) {
        tennisGame3DInstance.score = 0;
        tennisGame3DInstance.resetBall(1);
    } else if (currentSport === 'badminton' && badmintonGameInstance) {
        badmintonGameInstance.score = 0;
        if (typeof badmintonGameInstance.startGame === 'function') {
            badmintonGameInstance.startGame();
        } else if (typeof badmintonGameInstance.resetBirdie === 'function') {
            badmintonGameInstance.resetBirdie();
        }
    } else if (currentSport === 'boxing' && boxingGameInstance) {
        boxingGameInstance.resetRound();
    }
    updateScoreboard();
}

function isGameSectionActive() {
    const gameSection = document.getElementById('game');
    return Boolean(gameSection && gameSection.classList.contains('active'));
}

// Initialize MediaPipe
async function createTrackers() {
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
createTrackers();

if (gameCanvas) {
    createActiveGameForSport('tennis');
}

function refreshGameRendererSize() {
    if (activeGameInstance && typeof activeGameInstance.draw === 'function') {
        activeGameInstance.draw();
    }
}

function drawTrackingOverlay(nowMs) {
    if (!trackingOverlay || !video) return;
    const ctx = trackingOverlay.getContext('2d');
    if (!ctx) return;

    const width = Math.max(1, Math.floor(video.clientWidth || trackingOverlay.clientWidth || 1));
    const height = Math.max(1, Math.floor(video.clientHeight || trackingOverlay.clientHeight || 1));
    if (trackingOverlay.width !== width || trackingOverlay.height !== height) {
        trackingOverlay.width = width;
        trackingOverlay.height = height;
    }

    ctx.clearRect(0, 0, width, height);
    if (currentSport !== 'boxing' || !boxingGameInstance) return;

    const overlay = boxingGameInstance.getOverlayTargets();

    const smoothed = overlay.smoothedHand;
    if (smoothed) {
        const x = smoothed.x * width;
        const y = smoothed.y * height;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#9fd4ff';
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    }
}

function updateScoreboard() {
    const isTennis = currentSport === 'tennis' && tennisGame3DInstance;
    const isBadminton = currentSport === 'badminton' && badmintonGameInstance;
    const isBoxing = currentSport === 'boxing' && boxingGameInstance;
    const game = isTennis ? tennisGame3DInstance : (isBadminton ? badmintonGameInstance : (isBoxing ? boxingGameInstance : null));
    const scoreValue = isBadminton
        ? (game?.scorePlayer ?? game?.score ?? 0)
        : (game?.score ?? 0);
    const highScoreValue = isBadminton
        ? (game?.highScore ?? 0)
        : (game?.highScore ?? 0);
    const missValue = isBadminton
        ? (game?.scoreAI ?? 0)
        : (isBoxing ? (boxingGameInstance.missCount || 0) : 0);

    if (rallyScoreEl) rallyScoreEl.textContent = String(scoreValue);
    if (highScoreEl) highScoreEl.textContent = String(highScoreValue);
    if (missCountEl) missCountEl.textContent = String(missValue);
    if (currentSport === 'tennis' || currentSport === 'boxing' || currentSport === 'badminton') {
        persistHighScoreForSport(currentSport, highScoreValue);
    }
    const scoreLabels = document.querySelectorAll('.score-item .score-label');
    if (scoreLabels.length >= 3) {
        scoreLabels[0].textContent = currentSport === 'badminton' ? 'Player Score' : (currentSport === 'boxing' ? 'Score' : 'Rally');
        scoreLabels[1].textContent = currentSport === 'badminton' ? 'Opponent Score' : 'Misses';
        scoreLabels[2].textContent = 'High Score';
    }
}

window.addEventListener('resize', refreshGameRendererSize);

document.querySelectorAll('.sport-card').forEach(card => {
    card.addEventListener('click', () => {
        const sport = card.getAttribute('data-sport');
        if (sport !== 'tennis' && sport !== 'badminton' && sport !== 'boxing') return;
        if (sessionState.isActive) {
            endSession('sport-switch');
        }

        currentSport = sport;
        createActiveGameForSport(sport);
        resetSessionStateForSport(sport);

        if (gameTitle) {
            gameTitle.textContent =
                sport === 'tennis' ? '🏓 3D Webcam Table Tennis'
                    : sport === 'badminton' ? '🏸 3D Webcam Badminton'
                        : '🥊 3D Webcam Boxing';
        }
        if (gameSubtitle) {
            gameSubtitle.textContent =
                sport === 'tennis' ? 'Depth-based, hand-tracked table tennis in 3D.'
                    : sport === 'badminton' ? 'Swing naturally to drive, clear, and smash in 3D.'
                        : 'Reaction mode: hit timed targets before they expire.';
        }
        if (gameHint) {
            gameHint.textContent =
                sport === 'tennis'
                    ? "💡 Move your hand left/right for paddle placement and toward/away from camera for depth control."
                    : sport === 'badminton'
                        ? "💡 Use broad swings and forward/backward hand motion to shape shuttle direction and power."
                        : "💡 Keep your eyes on the big game screen. Touch red target quickly: hit = +1, miss = -1, 3 misses reset.";
        }

        navbarLinks.forEach(l => l.classList.remove('active'));
        const gameLink = document.querySelector('nav .nav-link[href="#game"]');
        if (gameLink) gameLink.classList.add('active');
        sections.forEach(s => s.classList.remove('active'));
        document.getElementById('game').classList.add('active');

        resetCurrentGame();
        requestAnimationFrame(refreshGameRendererSize);

        if (hasWebcamStream && startButton) {
            statusText.textContent = "✅ " + (sport === 'tennis' ? "Webcam Table Tennis ready." : sport === 'badminton' ? "Webcam Badminton ready." : "Webcam Boxing ready.") + " Click Start Session.";
            updateStartButtonState();
        }
        updateScoreboard();
    });
});

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
            statusText.textContent = currentSport === 'tennis'
                ? "✅ Webcam started! Raise your hand to play table tennis. Click Start Session."
                : currentSport === 'badminton'
                    ? "✅ Webcam started! Raise your hand to play badminton. Click Start Session."
                    : "✅ Webcam started! Watch the main game screen and move your hand to hit targets. Click Start Session.";

            if (!isRunning) {
                isRunning = true;
                resetCurrentGame();
                lastFrameTime = performance.now();
                requestAnimationFrame(gameLoop);
            }
            updateStartButtonState();
        });
    } catch (err) {
        console.error("Error accessing webcam:", err);
        statusText.textContent = "❌ Could not access webcam. Please allow camera permission and try again.";
    }
}



// Main game loop
async function gameLoop(timestamp) {
    if (!isRunning) return;

    if (!isGameSectionActive()) {
        requestAnimationFrame(gameLoop);
        return;
    }

    let gotFreshDetection = false;

    if (handLandmarker && video.readyState >= 2) {
        if (lastVideoTime !== video.currentTime) {
            lastVideoTime = video.currentTime;
            const handsResults = handLandmarker.detectForVideo(video, performance.now());
            currentTracking = {
                hands: handsResults?.landmarks && handsResults.landmarks.length > 0 ? handsResults.landmarks : null
            };

            if (currentTracking.hands && currentTracking.hands.length > 0) {
                const indexFingerTip = currentTracking.hands[0][8];
                const wrist = currentTracking.hands[0][0];
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
            } else if (currentSport === 'boxing') {
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
            currentTracking = { hands: null };
        }
    }

    const dtMs = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (!activeGameInstance && gameCanvas) {
        createActiveGameForSport(currentSport);
    }
    if (activeGameInstance) {
        if (currentSport === 'badminton' && typeof activeGameInstance.updateAndRender === 'function') {
            activeGameInstance.updateAndRender(null, dtMs, currentTracking?.hands, timestamp);
        } else {
            activeGameInstance.update(currentTracking, dtMs, timestamp);
            activeGameInstance.draw();
        }
    }
    drawTrackingOverlay(timestamp);
    updateScoreboard();

    requestAnimationFrame(gameLoop);
}

if (startButton) {
    startButton.addEventListener("click", async () => {
        if (!hasWebcamStream) {
            await startWebcam();
            return;
        }
        if (sessionState.isActive) {
            endSession();
        } else {
            startSession();
        }
    });
}

if (tennisGame3DInstance) {
    tennisGame3DInstance.draw();
}

// ===== HOME DASHBOARD - ACTIVITY CALENDAR =====
const homeCalendarHeatmap = document.getElementById('homeCalendarHeatmap');
const homeCalendarMonthLabels = document.getElementById('homeCalendarMonthLabels');
const activityModal = document.getElementById('activityModal');
const activityDate = document.getElementById('activityDate');
const activityContent = document.getElementById('activityContent');
const closeModal = document.getElementById('closeModal');

// Generate or retrieve real activity data
function getActivityData() {
    const data = localStorage.getItem('sportsCompActivity');
    return data ? JSON.parse(data) : {};
}

function logActivity(activityDetails) {
    const activities = getActivityData();
    const today = new Date().toISOString().split('T')[0];

    if (!activities[today]) {
        activities[today] = [];
    }

    activities[today].push({
        sport: activityDetails.sport,
        time: new Date().toLocaleTimeString(),
        duration: activityDetails.duration,
        durationSeconds: activityDetails.durationSeconds,
        calories: activityDetails.calories,
        notes: activityDetails.notes
    });
    localStorage.setItem('sportsCompActivity', JSON.stringify(activities));
    generateCalendarHeatmap();
}

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

    const current = Math.max(0, Math.round(Number(dailyCaloriesBurned) || 0));
    const goal = CALORIES_GOAL;
    const percentage = Math.min((current / goal) * 100, 100);
    caloriesValue.textContent = current.toLocaleString();

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
    const allActivityData = getActivityData();

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
            const activities = allActivityData[dateKey] || [];
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
            const calories = Number.isFinite(activity.calories) ? activity.calories : 0;
            const durationText = activity.duration || `${Math.max(1, activity.durationSeconds || 0)}s`;

            return `
                <div class="activity-item">
                    <div class="activity-item-header">
                        <span class="activity-sport">${activity.sport}</span>
                        <span class="activity-duration">${durationText}</span>
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
    updateHomeHighScoresDisplay();
    renderManualCaloriesLog();
    const addBtn = document.getElementById('addManualCaloriesBtn');
    const noteInput = document.getElementById('manualCaloriesNote');
    if (addBtn) addBtn.addEventListener('click', addManualCaloriesEntry);
    if (noteInput) {
        noteInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') addManualCaloriesEntry();
        });
    }
});
