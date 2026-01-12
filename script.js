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

const paddleWidth = 12;
const paddleHeight = 70;
const ballRadius = 7;

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

async function startWebcam() {
  try {
    statusText.textContent = "Requesting webcam access...";
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });
    video.srcObject = stream;
    hasWebcamStream = true;
    statusText.textContent = "Webcam started! Move your hand up and down on the LEFT side.";
    video.addEventListener("playing", () => {
      previousFrame = null;
      requestAnimationFrame(motionDetectionLoop);
    });
  } catch (err) {
    console.error("Error accessing webcam:", err);
    statusText.textContent = "Could not access webcam. Please allow camera permission and try again.";
  }
}

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
  const stripWidth = Math.floor(w * 0.35);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < stripWidth; x++) {
      const index = (y * w + x) * 4;
      const brightnessNow = (currentData[index] + currentData[index + 1] + currentData[index + 2]) / 3;
      const brightnessPrev = (prevData[index] + prevData[index + 1] + prevData[index + 2]) / 3;
      const diff = Math.abs(brightnessNow - brightnessPrev);
      if (diff > 25) {
        sumY += y;
        count++;
      }
    }
  }

  if (count > 50) {
    const averageY = sumY / count;
    const scaleY = gameCanvas.height / h;
    const targetY = averageY * scaleY;
    const smoothing = 0.2;
    detectedY = detectedY + (targetY - detectedY) * smoothing;
  }

  previousFrame = currentFrame;
}

function motionDetectionLoop() {
  if (hasWebcamStream) {
    detectMotionY();
    playerY = detectedY - paddleHeight / 2;
    playerY = Math.max(0, Math.min(gameCanvas.height - paddleHeight, playerY));
  }
  requestAnimationFrame(motionDetectionLoop);
}

function resetBall(directionX = 1) {
  ballX = gameCanvas.width / 2;
  ballY = gameCanvas.height / 2;
  ballSpeedX = 4 * directionX;
  ballSpeedY = (Math.random() * 3 + 2) * (Math.random() < 0.5 ? 1 : -1);
}

function updateAI() {
  const paddleCenter = aiY + paddleHeight / 2;
  if (ballY < paddleCenter - 10) {
    aiY -= aiSpeed;
  } else if (ballY > paddleCenter + 10) {
    aiY += aiSpeed;
  }
  aiY = Math.max(0, Math.min(gameCanvas.height - paddleHeight, aiY));
}

function updateBall() {
  ballX += ballSpeedX;
  ballY += ballSpeedY;

  if (ballY - ballRadius < 0 && ballSpeedY < 0) {
    ballY = ballRadius;
    ballSpeedY *= -1;
  }

  if (ballY + ballRadius > gameCanvas.height && ballSpeedY > 0) {
    ballY = gameCanvas.height - ballRadius;
    ballSpeedY *= -1;
  }

  if (
    ballX - ballRadius < paddleWidth &&
    ballY > playerY &&
    ballY < playerY + paddleHeight &&
    ballSpeedX < 0
  ) {
    ballX = paddleWidth + ballRadius;
    ballSpeedX *= -1;
    const hitPos = ballY - (playerY + paddleHeight / 2);
    ballSpeedY += hitPos * 0.05;
  }

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

  if (ballX < 0) {
    aiScore++;
    resetBall(1);
  }

  if (ballX > gameCanvas.width) {
    playerScore++;
    resetBall(-1);
  }
}

function drawGame() {
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

  ctx.fillStyle = "#f5f5f5";
  ctx.fillRect(0, playerY, paddleWidth, paddleHeight);
  ctx.fillRect(gameCanvas.width - paddleWidth, aiY, paddleWidth, paddleHeight);

  ctx.beginPath();
  ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
  ctx.fillStyle = "#ffce54";
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "20px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(playerScore.toString(), gameCanvas.width / 4, 30);
  ctx.fillText(aiScore.toString(), (gameCanvas.width * 3) / 4, 30);

  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "#c4c7ff";
  ctx.fillText("YOU", gameCanvas.width / 4, 48);
  ctx.fillText("CPU", (gameCanvas.width * 3) / 4, 48);
}

function gameLoop() {
  if (!isRunning) return;
  updateAI();
  updateBall();
  drawGame();
  requestAnimationFrame(gameLoop);
}

startButton.addEventListener("click", async () => {
  if (!hasWebcamStream) {
    await startWebcam();
  }
  if (!isRunning && hasWebcamStream) {
    isRunning = true;
    statusText.textContent = "Game running! Wave your hand up and down on the LEFT side of the camera.";
    resetBall(1);
    gameLoop();
  }
});

drawGame();
