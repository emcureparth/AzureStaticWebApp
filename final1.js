// final1.js - JavaScript extracted from final1.html
import {
  FilesetResolver,
  FaceLandmarker,
  GestureRecognizer
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.mjs";

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const mainLabels = document.getElementById("mainLabels");
const mainLabel1 = document.getElementById("mainLabel1");
const mainLabel2 = document.getElementById("mainLabel2");
const bottomLabel = document.getElementById("bottomLabel");
const questionLabel = document.getElementById("questionLabel");
const countdownEl = document.getElementById("countdown");
const confettiVideo = document.getElementById("confettiVideo");
const catalogueBtn = document.getElementById("catalogueBtn");
const catalogueScreen = document.getElementById("catalogueScreen");
const backToQuizBtn = document.getElementById("backToQuizBtn");
const screensaverVideo = document.getElementById("screensaverVideo");

let questions = [], selectedQuestions = [], currentQuestionIndex = 0;
let question = null, state = "idle";
let correctCount = 0, answerLocked = false, faceLastDetected = Date.now();
let countdownValue = 3, countdownInterval = null;
let productAlpha = 0, productFadeState = "in", productDisplayTimer = 0;
let productImg = new Image();

const correctImage = new Image();
correctImage.src = "./assets/images/correct.png";
const wrongImage = new Image();
wrongImage.src = "./assets/images/wrong.png";
const finalSuccess = new Image();
finalSuccess.src = "./assets/images/final-success.png";
const finalFail = new Image();
finalFail.src = "./assets/images/final-fail.png";
const congratsBadge = new Image();
congratsBadge.src = "./assets/images/congrats-badge.png";

let showResultImage = null;
let resultImageTimer = 0;
let resultImageAlpha = 1;

let confettiFired = false;

const bubbleVideo = document.createElement("video");
bubbleVideo.src = "./assets/videos/bubble.webm";
bubbleVideo.loop = true;
bubbleVideo.muted = true;
bubbleVideo.playsInline = true;
bubbleVideo.autoplay = true;
bubbleVideo.style.display = "none";
document.body.appendChild(bubbleVideo);
bubbleVideo.play();

catalogueBtn.onclick = () => {
  if (state === "idle" || state === "result") {
    window.location.href = 'catalogue.html';
  }
};

backToQuizBtn.onclick = () => {
  catalogueScreen.style.display = "none";
  document.getElementById("container").style.display = "flex";
  state = "idle";
  mainLabels.style.display = "flex";
  bottomLabel.style.display = "block";
};

async function loadQuestions() {
  try {
    const response = await fetch("questions.json");
    questions = await response.json();
    if (!questions.length) throw new Error("No questions found.");
  } catch (e) {
    console.error(e);
  }
}

async function getExternalCameraDeviceId() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const videoDevices = devices.filter(d => d.kind === 'videoinput');
  return videoDevices[videoDevices.length - 1].deviceId;
}

async function initCamera() {
  const deviceId = await getExternalCameraDeviceId();
  const stream = await navigator.mediaDevices.getUserMedia({
    video: {
      deviceId: { exact: deviceId },
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    }
  });
  video.srcObject = stream;
  await new Promise(resolve => video.onloadedmetadata = () => (video.play(), resizeCanvas(), resolve()));
}

function resizeCanvas() {
  canvas.width = video.offsetWidth;
  canvas.height = video.offsetHeight;
}

function drawCroppedVideo() {
  const sw = video.videoWidth, sh = video.videoHeight;
  const targetAspect = 9 / 16, cropW = sh * targetAspect, cropX = (sw - cropW) / 2;
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, cropX, 0, cropW, sh, 0, 0, canvas.width, canvas.height);
  ctx.restore();
}

function startQuiz() {
  selectedQuestions = questions.sort(() => 0.5 - Math.random()).slice(0, 3);
  currentQuestionIndex = 0;
  correctCount = 0;
  question = selectedQuestions[0];
  productImg.src = question.productImage;
  answerLocked = false;
  mainLabels.style.display = "none";
  bottomLabel.style.display = "none";
  questionLabel.textContent = question.statement;
  questionLabel.style.display = "block";
  setTimeout(() => { questionLabel.style.opacity = 1; }, 10);
  state = "inQuestion";
}

function nextQuestion() {
  showResultImage = null;
  resultImageTimer = 0;
  resultImageAlpha = 1;
  currentQuestionIndex++;
  if (currentQuestionIndex >= selectedQuestions.length) {
    state = "result";
    resultImageTimer = 180;
    questionLabel.style.display = "none";
    return;
  }
  question = selectedQuestions[currentQuestionIndex];
  productImg.src = question.productImage;
  answerLocked = false;
  questionLabel.textContent = question.statement;
  questionLabel.style.display = "block";
  setTimeout(() => { questionLabel.style.opacity = 1; }, 10);
}

// Use local paths for all assets, models, and wasm files
const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm");
const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    delegate: "GPU"
  },
  runningMode: "VIDEO"
});

const gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
    delegate: "GPU"
  },
  runningMode: "VIDEO"
});

window.addEventListener('resize', resizeCanvas);
window.addEventListener('resize', fitCatalogueBtnText);

let screensaverTimeout = null;
let screensaverActive = false;
function showScreensaver() {
  screensaverVideo.style.display = "block";
  screensaverVideo.currentTime = 0;
  screensaverVideo.play();
  screensaverActive = true;
}
function hideScreensaver() {
  screensaverVideo.pause();
  screensaverVideo.style.display = "none";
  screensaverActive = false;
}
function resetScreensaverTimer() {
  if (screensaverTimeout) clearTimeout(screensaverTimeout);
  if (screensaverActive) hideScreensaver();
  screensaverTimeout = setTimeout(showScreensaver, 20000); // 20s
}

function fitCatalogueBtnText() {
  const btn = document.getElementById('catalogueBtn');
  const span = document.getElementById('catalogueBtnText');
  if (!btn || !span) return;
  // Reset font size to max
  span.style.fontSize = '';
  let minFont = 10;
  let maxFont = parseFloat(getComputedStyle(btn).fontSize) || 24;
  let btnPadding = 0;
  // Try to get padding if set
  try {
    btnPadding = parseFloat(getComputedStyle(btn).paddingLeft) + parseFloat(getComputedStyle(btn).paddingRight);
  } catch {}
  // Binary search for best font size
  let best = minFont;
  for (let i = 0; i < 10; i++) {
    let mid = (minFont + maxFont) / 2;
    span.style.fontSize = mid + 'px';
    // Use scrollWidth to check if it fits
    if (span.scrollWidth <= btn.clientWidth - btnPadding && span.offsetHeight <= btn.clientHeight) {
      best = mid;
      minFont = mid;
    } else {
      maxFont = mid;
    }
  }
  span.style.fontSize = best + 'px';
}
window.fitCatalogueBtnText = fitCatalogueBtnText;
window.addEventListener('resize', fitCatalogueBtnText);
setTimeout(fitCatalogueBtnText, 100);
document.addEventListener('DOMContentLoaded', fitCatalogueBtnText);

async function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state === "idle" || state === "result") {
    catalogueBtn.style.display = "flex";
  } else {
    catalogueBtn.style.display = "none";
  }
  if (state === "showingProduct") {
    questionLabel.textContent = question.truth;
    questionLabel.style.display = "block";
    setTimeout(() => { questionLabel.style.opacity = 1; }, 10);
    if (productFadeState === "in") {
      productAlpha += 0.15;
      if (productAlpha >= 1) {
        productAlpha = 1;
        productFadeState = "hold";
        productDisplayTimer = 30;
      }
    } else if (productFadeState === "hold") {
      if (--productDisplayTimer <= 0) productFadeState = "out";
    } else if (productFadeState === "out") {
      productAlpha -= 0.15;
      if (productAlpha <= 0) {
        productAlpha = 0;
        state = "inQuestion";
        nextQuestion();
      }
    }
    ctx.save();
    ctx.filter = 'blur(10px)';
    drawCroppedVideo();
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = productAlpha;
    ctx.font = `bold ${Math.min(canvas.width * 0.06, 28)}px sans-serif`;
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    const words = question.productLine.split(" "), maxW = canvas.width * 0.9;
    let line = "", y = canvas.height / 2 - canvas.height * 0.25;
    for (let w of words) {
      const testLine = line + w + " ";
      if (ctx.measureText(testLine).width > maxW) {
        ctx.fillText(line.trim(), canvas.width / 2, y);
        line = w + " ";
        y += 30;
      } else line = testLine;
    }
    ctx.fillText(line.trim(), canvas.width / 2, y);
    const scale = 0.5;
    const iw = canvas.width * scale;
    const ih = canvas.height * scale;
    const ix = (canvas.width - iw) / 2;
    const iy = y + 30;
    ctx.drawImage(productImg, ix, iy, iw, ih);
    ctx.restore();
  } else if (state === "result") {
    questionLabel.style.opacity = 0;
    setTimeout(() => { questionLabel.style.display = "none"; questionLabel.textContent = ''; }, 400);
    drawCroppedVideo();
    const resultImg = correctCount === selectedQuestions.length ? finalSuccess : finalFail;
    const imgW = canvas.width * 0.7;
    const imgH = imgW * (resultImg.height / resultImg.width || 1);
    const imgX = (canvas.width - imgW) / 2;
    const imgY = canvas.height - imgH - canvas.height * 0.04;
    ctx.drawImage(resultImg, imgX, imgY, imgW, imgH);
    if (correctCount === selectedQuestions.length) {
      const badgeWidth = canvas.width * 0.7;
      const badgeHeight = canvas.width * 0.3
      ctx.drawImage(congratsBadge, (canvas.width - badgeWidth) / 2, 40, badgeWidth, badgeHeight);
      if (confettiVideo.paused) {
        confettiVideo.style.display = "block";
        confettiVideo.currentTime = 0;
        confettiVideo.play();
        confettiVideo.onended = () => {
          confettiVideo.style.display = "none";
        };
      }
    } else {
      confettiVideo.style.display = "none";
      confettiVideo.pause();
    }
    if (--resultImageTimer <= 0) {
      state = "idle";
    }
  } else if (state === "inQuestion") {
    questionLabel.textContent = question.statement;
    questionLabel.style.display = "block";
    setTimeout(() => { questionLabel.style.opacity = 1; }, 10);
    drawCroppedVideo();
  } else {
    questionLabel.style.opacity = 0;
    setTimeout(() => { questionLabel.style.display = "none"; questionLabel.textContent = ''; }, 400);
    drawCroppedVideo();
  }
  if (showResultImage && resultImageTimer > 0) {
    const iw = canvas.width * 0.7;
    const ih = iw * (showResultImage.height / showResultImage.width || 1);
    const ix = (canvas.width - iw) / 2;
    const iy = canvas.height - ih - canvas.height * 0.04;
    ctx.save();
    ctx.globalAlpha = resultImageAlpha;
    ctx.drawImage(showResultImage, ix, iy, iw, ih);
    ctx.restore();
    resultImageTimer--;
    if (resultImageTimer < 30) resultImageAlpha = resultImageTimer / 30;
  }
  if (state === "idle") {
    mainLabels.style.display = "flex";
    bottomLabel.style.display = "block";
    questionLabel.style.opacity = 0;
    setTimeout(() => { questionLabel.style.display = "none"; questionLabel.textContent = ''; }, 400);
  } else {
    mainLabels.style.display = "none";
    bottomLabel.style.display = "none";
  }
  const now = performance.now();
  try {
    const face = await faceLandmarker.detectForVideo(video, now);
    const gest = await gestureRecognizer.recognizeForVideo(video, now);
    const gesture = gest.gestures[0]?.[0]?.categoryName || "None";
    if (face.faceLandmarks.length > 0) {
      resetScreensaverTimer();
    }
    if (face.faceLandmarks.length > 0 || gesture !== "None") {
      resetScreensaverTimer();
    }
    if (face.faceLandmarks.length > 0) {
      faceLastDetected = Date.now();
      if (gesture === "Open_Palm" && ["idle", "result"].includes(state) && !countdownInterval) {
        state = "countdown";
        countdownValue = 3;
        countdownEl.style.display = "block";
        countdownEl.textContent = countdownValue;
        countdownInterval = setInterval(() => {
          if (--countdownValue > 0) {
            countdownEl.textContent = countdownValue;
          } else {
            clearInterval(countdownInterval);
            countdownInterval = null;
            countdownEl.style.display = "none";
            startQuiz();
          }
        }, 1000);
      }
      if (state === "inQuestion" && !answerLocked) {
        // Use ear landmarks for bubble positions
        const [leftEar, rightEar] = [127, 356].map(i => face.faceLandmarks[0][i]);
        const leftEarX = canvas.width * (1 - leftEar.x);
        const rightEarX = canvas.width * (1 - rightEar.x);
        const earY = canvas.height * ((leftEar.y + rightEar.y) / 2); // average height of ears
        const size = canvas.width * 0.28;

        const bubbles = [
          {
            x: leftEarX - size - 100,
            y: earY - size / 2,
            label: question.options[0]
          },
          {
            x: rightEarX + 100,
            y: earY - size / 2,
            label: question.options[1]
          }
        ];

        ctx.font = `${size * 0.15}px sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        for (let b of bubbles) {
          ctx.drawImage(bubbleVideo, b.x, b.y, size, size);
          ctx.fillStyle = "white";
          ctx.fillText(b.label, b.x + size / 2, b.y + size / 2);
        }
        if (gesture === "Open_Palm" && gest.landmarks[0]) {
          const p = gest.landmarks[0][8], x = (1 - p.x) * canvas.width, y = p.y * canvas.height;
          for (let b of bubbles) {
            if (x > b.x && x < b.x + size && y > b.y && y < b.y + size) {
              answerLocked = true;
              const isCorrect = b.label === question.correct;
              if (isCorrect) correctCount++;
              showResultImage = isCorrect ? correctImage : wrongImage;
              resultImageAlpha = 1;
              resultImageTimer = 90;
              setTimeout(() => {
                showResultImage = null;
                resultImageTimer = 0;
                resultImageAlpha = 1;
                state = "showingProduct";
                productAlpha = 0;
                productFadeState = "in";
              }, 1500);
            }
          }
        }
      }
    } else if (Date.now() - faceLastDetected > 12000 && state !== "countdown") {
      state = "idle";
      mainLabels.style.display = "flex";
      bottomLabel.style.display = "block";
    }
  } catch (e) {
    console.warn(e);
  }
  requestAnimationFrame(render);
}

await loadQuestions();
await initCamera();
render();
resetScreensaverTimer();
fitCatalogueBtnText();
