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
                gameTitle.textContent = sport === 'tennis' ? '🏓 3D Table Tennis' : '🏸 3D Badminton';
            }
            if (gameSubtitle) {
                gameSubtitle.textContent = sport === 'tennis' ? 
                    'Experience motion-controlled 3D table tennis!' : 
                    'Swing your hand to smash the 3D shuttlecock!';
            }
            
            navbarLinks.forEach(l => l.classList.remove('active'));
            const gameLink = document.querySelector('nav .nav-link[href="#game"]');
            if (gameLink) gameLink.classList.add('active');
            sections.forEach(s => s.classList.remove('active'));
            document.getElementById('game').classList.add('active');
            
            if (typeof tableTennis3DInstance !== 'undefined' && tableTennis3DInstance) {
                if (sport === 'tennis') tableTennis3DInstance.startGame();
            }
            if (typeof badminton3DInstance !== 'undefined' && badminton3DInstance) {
                if (sport === 'badminton') badminton3DInstance.startGame();
            }
            
            // If already streaming, but the user clicks the card, make sure button is hidden
            if (typeof hasWebcamStream !== 'undefined' && hasWebcamStream && typeof startButton !== 'undefined' && startButton) {
                startButton.style.display = 'none';
                if (typeof statusText !== 'undefined' && statusText) {
                    statusText.textContent = "✅ " + (sport === 'tennis' ? "Webcam 3D Table Tennis Active!" : "Webcam 3D Badminton Active!");
                }
                const gameOverlay = document.getElementById("gameOverlay");
                if (gameOverlay) gameOverlay.style.display = 'block';
            }
        }
    });
});

// ===== GAME LOGIC (MediaPipe Hand Tracking & 3D WebGL) =====
import { HandLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.js";
import { TableTennis3D } from "./src/games/tableTennis3D.js";
import { Badminton3D } from "./src/games/badminton3D.js";

let currentSport = 'tennis';
let tableTennis3DInstance = null;
let badminton3DInstance = null;

const startButton = document.getElementById("startButton");
const statusText = document.getElementById("statusText");
const video = document.getElementById("video");
const gameCanvas = document.getElementById("gameCanvas");
const gameOverlay = document.getElementById("gameOverlay");

let handLandmarker = undefined;
let webcamRunning = false;
let lastVideoTime = -1;
let hasWebcamStream = false;

let isRunning = false;
let lastFrameTime = performance.now();

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
            if (gameOverlay) gameOverlay.style.display = 'block';
            statusText.textContent = currentSport === 'tennis' 
                ? "✅ Webcam started! Raise your hand to play 3D table tennis."
                : "✅ Webcam started! Raise your hand to play 3D badminton.";
                
            if (!isRunning) {
                if (!tableTennis3DInstance) {
                    tableTennis3DInstance = new TableTennis3D(gameCanvas);
                }
                if (!badminton3DInstance) {
                    badminton3DInstance = new Badminton3D(gameCanvas);
                }
                
                isRunning = true;
                if (currentSport === 'tennis') {
                    tableTennis3DInstance.startGame();
                } else if (currentSport === 'badminton') {
                    badminton3DInstance.startGame();
                }
                lastFrameTime = performance.now();
                requestAnimationFrame(gameLoop);
            }
        });
    } catch (err) {
        console.error("Error accessing webcam:", err);
        statusText.textContent = "❌ Could not access webcam. Please allow permission and try again.";
    }
}

// Main game loop
async function gameLoop(timestamp) {
    if (!isRunning) return;

    let handPos = null;
    let currentLandmarks = null;

    if (handLandmarker && video.readyState >= 2) {
        if (lastVideoTime !== video.currentTime) {
            lastVideoTime = video.currentTime;
            const results = handLandmarker.detectForVideo(video, performance.now());
            if (results.landmarks && results.landmarks.length > 0) {
                currentLandmarks = results.landmarks;
                const palm = results.landmarks[0][9];
                const wrist = results.landmarks[0][0];
                
                handPos = {
                    x: (palm.x * 0.7) + (wrist.x * 0.3),
                    y: (palm.y * 0.7) + (wrist.y * 0.3)
                };
            }
        }
    }

    const dtMs = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    if (currentSport === 'tennis' && tableTennis3DInstance) {
        tableTennis3DInstance.updateAndRender(handPos, dtMs, currentLandmarks, timestamp);
    } else if (currentSport === 'badminton' && badminton3DInstance) {
        badminton3DInstance.updateAndRender(handPos, dtMs, currentLandmarks, timestamp);
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
