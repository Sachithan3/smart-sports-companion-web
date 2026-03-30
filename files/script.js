// ===== NAVIGATION LOGIC =====
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.page-section');

navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href').substring(1);
        
        // Update active states
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
        
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
// Make Table Tennis card navigate to game section
document.querySelector('[data-sport="tennis"]').addEventListener('click', () => {
    navLinks.forEach(l => l.classList.remove('active'));
    document.querySelector('[href="#game"]').classList.add('active');
    sections.forEach(s => s.classList.remove('active'));
    document.getElementById('game').classList.add('active');
});

// ===== TABLE TENNIS GAME LOGIC (Original Motion Detection Game) =====
const startButton = document.getElementById("startButton");
const statusText = document.getElementById("statusText");
const video = document.getElementById("video");
const motionCanvas = document.getElementById("motionCanvas");
const motionCtx = motionCanvas.getContext("2d");
const gameCanvas = document.getElementById("gameCanvas");
const ctx = gameCanvas.getContext("2d");

let previousFrame = null;
let detectedY = gameCanvas.height / 2;
let hasWebcamStream = false;

// Game constants
const paddleWidth = 12;
const paddleHeight = 70;
const ballRadius = 7;

// Game state variables
let playerY = gameCanvas.height / 2 - paddleHeight / 2;
let aiY = gameCanvas.height / 2 - paddleHeight / 2;
const aiSpeed = 3;

let ballX = gameCanvas.width / 2;
let ballY = gameCanvas.height / 2;
let ballSpeedX = 4;
let ballSpeedY = 2.5;

let playerScore = 0;
let aiScore = 0;

let isRunning = false;

// Request webcam access and start video stream
async function startWebcam() {
    try {
        statusText.textContent = "Requesting webcam access...";
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false,
        });
        video.srcObject = stream;
        hasWebcamStream = true;
        statusText.textContent = "✅ Webcam started! Move your hand up and down on the LEFT side.";
        video.addEventListener("playing", () => {
            previousFrame = null;
            requestAnimationFrame(motionDetectionLoop);
        });
    } catch (err) {
        console.error("Error accessing webcam:", err);
        statusText.textContent = "❌ Could not access webcam. Please allow camera permission and try again.";
    }
}

// Detect motion in the left portion of the video feed
function detectMotionY() {
    const w = motionCanvas.width;
    const h = motionCanvas.height;
    motionCtx.drawImage(video, 0, 0, w, h);
    const currentFrame = motionCtx.getImageData(0, 0, w, h);
    
    if (!previousFrame) {
        previousFrame = currentFrame;
        return;
    }

    const currentData = currentFrame.data;
    const prevData = previousFrame.data;

    let sumY = 0;
    let count = 0;
    const stripWidth = Math.floor(w * 0.35); // Detect motion only in left 35% of frame

    // Compare current frame with previous frame to detect motion
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < stripWidth; x++) {
            const index = (y * w + x) * 4;
            const brightnessNow = (currentData[index] + currentData[index + 1] + currentData[index + 2]) / 3;
            const brightnessPrev = (prevData[index] + prevData[index + 1] + prevData[index + 2]) / 3;
            const diff = Math.abs(brightnessNow - brightnessPrev);
            
            // If significant change detected, track this pixel's Y position
            if (diff > 25) {
                sumY += y;
                count++;
            }
        }
    }

    // Calculate average Y position of motion and smooth the movement
    if (count > 50) {
        const averageY = sumY / count;
        const scaleY = gameCanvas.height / h;
        const targetY = averageY * scaleY;
        const smoothing = 0.2;
        detectedY = detectedY + (targetY - detectedY) * smoothing;
    }

    previousFrame = currentFrame;
}

// Continuous loop for motion detection
function motionDetectionLoop() {
    if (hasWebcamStream) {
        detectMotionY();
        playerY = detectedY - paddleHeight / 2;
        // Keep paddle within canvas bounds
        playerY = Math.max(0, Math.min(gameCanvas.height - paddleHeight, playerY));
    }
    requestAnimationFrame(motionDetectionLoop);
}

// Reset ball position after scoring
function resetBall(directionX = 1) {
    ballX = gameCanvas.width / 2;
    ballY = gameCanvas.height / 2;
    ballSpeedX = 4 * directionX;
    ballSpeedY = (Math.random() * 3 + 2) * (Math.random() < 0.5 ? 1 : -1);
}

// AI paddle follows the ball
function updateAI() {
    const paddleCenter = aiY + paddleHeight / 2;
    if (ballY < paddleCenter - 10) {
        aiY -= aiSpeed;
    } else if (ballY > paddleCenter + 10) {
        aiY += aiSpeed;
    }
    aiY = Math.max(0, Math.min(gameCanvas.height - paddleHeight, aiY));
}

// Update ball position and handle collisions
function updateBall() {
    ballX += ballSpeedX;
    ballY += ballSpeedY;

    // Top wall collision
    if (ballY - ballRadius < 0 && ballSpeedY < 0) {
        ballY = ballRadius;
        ballSpeedY *= -1;
    }

    // Bottom wall collision
    if (ballY + ballRadius > gameCanvas.height && ballSpeedY > 0) {
        ballY = gameCanvas.height - ballRadius;
        ballSpeedY *= -1;
    }

    // Player paddle collision
    if (
        ballX - ballRadius < paddleWidth &&
        ballY > playerY &&
        ballY < playerY + paddleHeight &&
        ballSpeedX < 0
    ) {
        ballX = paddleWidth + ballRadius;
        ballSpeedX *= -1;
        const hitPos = ballY - (playerY + paddleHeight / 2);
        ballSpeedY += hitPos * 0.05; // Add spin based on where ball hits paddle
    }

    // AI paddle collision
    const rightPaddleX = gameCanvas.width - paddleWidth;
    if (
        ballX + ballRadius > rightPaddleX &&
        ballY > aiY &&
        ballY < aiY + paddleHeight &&
        ballSpeedX > 0
    ) {
        ballX = rightPaddleX - ballRadius;
        ballSpeedX *= -1;
        const hitPos = ballY - (aiY + paddleHeight / 2);
        ballSpeedY += hitPos * 0.05;
    }

    // Scoring - ball went past player paddle
    if (ballX < 0) {
        aiScore++;
        resetBall(1);
    }

    // Scoring - ball went past AI paddle
    if (ballX > gameCanvas.width) {
        playerScore++;
        resetBall(-1);
    }
}

// Draw the game scene
function drawGame() {
    ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

    // Semi-transparent overlay for trail effect
    ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
    ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

    // Center line
    ctx.strokeStyle = "#3e4370";
    ctx.setLineDash([8, 12]);
    ctx.beginPath();
    ctx.moveTo(gameCanvas.width / 2, 0);
    ctx.lineTo(gameCanvas.width / 2, gameCanvas.height);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw paddles
    ctx.fillStyle = "#f5f5f5";
    ctx.fillRect(0, playerY, paddleWidth, paddleHeight);
    ctx.fillRect(gameCanvas.width - paddleWidth, aiY, paddleWidth, paddleHeight);

    // Draw ball
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#ffce54";
    ctx.fill();

    // Draw scores
    ctx.fillStyle = "#ffffff";
    ctx.font = "20px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(playerScore.toString(), gameCanvas.width / 4, 30);
    ctx.fillText(aiScore.toString(), (gameCanvas.width * 3) / 4, 30);

    // Draw player labels
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#c4c7ff";
    ctx.fillText("YOU", gameCanvas.width / 4, 48);
    ctx.fillText("CPU", (gameCanvas.width * 3) / 4, 48);
}

// Main game loop
function gameLoop() {
    if (!isRunning) return;
    updateAI();
    updateBall();
    drawGame();
    requestAnimationFrame(gameLoop);
}

// Start button event listener
startButton.addEventListener("click", async () => {
    if (!hasWebcamStream) {
        await startWebcam();
    }
    if (!isRunning && hasWebcamStream) {
        isRunning = true;
        statusText.textContent = "🎮 Game running! Wave your hand up and down on the LEFT side of the camera.";
        resetBall(1);
        gameLoop();
    }
});

// Draw initial game state
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
// ========================================
// FEATURE 1, 2, 3: ENHANCED FEATURES
// ========================================

// ===== FEATURE 3: USER NAME GREETING AND VISIT COUNTER =====
// Function to handle user greeting and visit tracking
function initUserGreeting() {
    const userGreetingDiv = document.getElementById('userGreeting');
    
    if (!userGreetingDiv) return;
    
    // Get stored user name from localStorage
    let userName = localStorage.getItem('userName');
    
    // If no name is stored, ask the user for their name
    if (!userName) {
        userName = prompt('Welcome to KineticAI! Please enter your name:');
        
        // If user provides a name, store it
        if (userName && userName.trim() !== '') {
            userName = userName.trim();
            localStorage.setItem('userName', userName);
        } else {
            // Default name if user cancels or enters nothing
            userName = 'Guest';
        }
    }
    
    // Get visit count from localStorage
    let visitCount = localStorage.getItem('visitCount');
    
    // Initialize or increment visit count
    if (visitCount === null) {
        visitCount = 1;
    } else {
        visitCount = Number(visitCount) + 1;
    }
    
    // Store updated visit count
    localStorage.setItem('visitCount', visitCount);
    
    // Create greeting message
    const greetingHTML = `
        <h2>Hello, ${userName}! 👋</h2>
        <p>You have visited this page <strong>${visitCount}</strong> ${visitCount === 1 ? 'time' : 'times'}.</p>
    `;
    
    // Display greeting
    userGreetingDiv.innerHTML = greetingHTML;
}

// ===== FEATURE 2: DISPLAY IMAGES USING JAVASCRIPT LOOP =====
// Function to dynamically create and display image gallery
function createImageGallery() {
    const imageGalleryDiv = document.getElementById('imageGallery');
    
    if (!imageGalleryDiv) return;
    
    // Array of sports images with their details
    // Using local SVG images stored in the images folder
    const sportsImages = [
        {
            url: 'images/table-tennis.png',
            title: 'Table Tennis',
            description: 'Fast-paced racket sport'
        },
        {
            url: 'images/football.png',
            title: 'Football',
            description: 'The beautiful game'
        },
        {
            url: 'images/badminton.png',
            title: 'Badminton',
            description: 'Precision and agility'
        },
        {
            url: 'images/basketball.png',
            title: 'Basketball',
            description: 'Team sport excellence'
        }
    ];
    
    // Clear any existing content
    imageGalleryDiv.innerHTML = '';
    
    // Use forEach loop to iterate through images array
    sportsImages.forEach(function(sport, index) {
        // Create gallery item container
        const galleryItem = document.createElement('div');
        galleryItem.className = 'gallery-item';
        
        // Create image element
        const img = document.createElement('img');
        img.src = sport.url;
        img.alt = sport.title;
        img.loading = 'lazy';
        
        // Create caption container
        const caption = document.createElement('div');
        caption.className = 'gallery-item-caption';
        
        // Create title element
        const title = document.createElement('div');
        title.className = 'gallery-item-title';
        title.textContent = sport.title;
        
        // Create description element
        const desc = document.createElement('div');
        desc.className = 'gallery-item-desc';
        desc.textContent = sport.description;
        
        // Assemble the gallery item
        caption.appendChild(title);
        caption.appendChild(desc);
        galleryItem.appendChild(img);
        galleryItem.appendChild(caption);
        
        // Add to gallery
        imageGalleryDiv.appendChild(galleryItem);
    });
}
window.addEventListener('DOMContentLoaded', function() {
    initUserGreeting();
    createImageGallery();
});

