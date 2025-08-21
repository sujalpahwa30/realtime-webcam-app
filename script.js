const video = document.getElementById('videoFeed');
const canvas = document.getElementById('canvas');
const baseURL = document.getElementById('baseURL');
const instructionText = document.getElementById('instructionText');
const responseText = document.getElementById('responseText');
const responseHistory = document.getElementById('responseHistory');
const intervalSelect = document.getElementById('intervalSelect');
const startButton = document.getElementById('startButton');
const captureOnceButton = document.getElementById('captureOnce');
const spinner = document.getElementById('spinner');

let stream;
let intervalId;
let isProcessing = false;
let requestInFlight = false; // Prevent overlapping 

instructionText.value = "What do you see?";

// <-- API Call -->
async function sendChatCompletionRequest(instruction, imageBase64URL) {
    const response = await fetch(`${baseURL.value}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            max_tokens: 100,
            messages: [
                { role: 'user', context: [
                    { type: 'text', text: instruction},
                    { type: 'image_url', image_url: { url: imageBase64URL } }
                ]   }
            ]
        })
    });

    if(!response.ok) {
        const errorData = await response.text();
        throw new Error(`Server error ${response.status}: ${errorData}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
}

// <-- Camera Setup -->
async function initCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        video.srcObject = stream;
        responseText.value = "✅ Camera access granted. Ready to start.";
    } catch (err) {
        console.error("Camera error:", err);
        responseText.value = `Error: ${err.name} - ${err.message}`;
        alert(`Camera error: ${err.name}`);
    }
}

// <-- Capture Frame -->
function captureImage() {
    if (!stream || !video.videoWidth) return null;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.8);
}

// <-- Send Data -->
async function sendData() {
    if (requestInFlight) return;
    requestInFlight = true;
    spinner.classList.remove('hidden');

    const instruction = instructionText.value;
    const imageBase64URL = captureImage();

    if(!imageBase64URL) {
        responseText.value = "⚠️ Failed to capture image.";
        requestInFlight = false;
        spinner.classList.add('hidden');
        return;
    }

    try {
        const response = await sendChatCompletionRequest(instruction, imageBase64URL);
        responseText.value = response;

        const li = document.createElement('li');
        li.textContent = response;
        responseHistory.prepend(li); // latest first
    } catch (error) {
        responseText.value = `❌ Error: ${error.message}`;
    } finally {
        requestInFlight = false;
        spinner.classList.add('hidden');
    }
}

// <-- Controls -->
function handleStart() {
    if (!stream) {
        alert("Camera not available.");
        return;
    }
    isProcessing = true;
    startButton.textContent = "Stop";
    startButton.classList.replace('start', 'stop');
    instructionText.disabled = true;
    instructionText.disabled = true;
    responseText.value = "▶ Processing started...";

    const intervalMs = parseInt(intervalSelect.value, 10);
    sendData();
    intervalId = setInterval(sendData, intervalMs);
}

function handleStop() {
    isProcessing = false;
    clearInterval(intervalId);
    startButton.textContent = "Start";
    startButton.classList.replace('stop', 'start');
    instructionText.disabled = false;
    intervalSelect.disabled = false;
    responseText.value = "⏹ Processing stopped.";
}

// <-- Event Listeners -->
startButton.addEventListener('click', () => {
    isProcessing ? handleStop() : handleStart();
});

captureOnceButton.addEventListener('click', sendData);

window.addEventListener('DOMContentLoaded', initCamera);

window.addEventListener('beforeunload', () => {
    if (stream) stream.getTracks().forEach(track => track.stop());
    if (intervalId) clearInterval(intervalId);
});