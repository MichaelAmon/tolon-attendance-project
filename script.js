// Office locations
const OFFICE_LOCATIONS = [
  { name: 'Head Office', lat: 9.429241474535132, long: -1.0533786340817441, radius: 0.15 },
  { name: 'Nyankpala', lat: 9.404691157748209, long: -0.9838639320946208, radius: 0.15 }
];

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(value) {
  return value * Math.PI / 180;
}

function getOfficeName(lat, long) {
  return OFFICE_LOCATIONS.find(office =>
    getDistance(lat, long, office.lat, office.long) <= office.radius
  )?.name || null;
}

let watchId = null;
let video, canvas;

async function startLocationWatch() {
  const status = document.getElementById('status');
  const location = document.getElementById('location');
  const clockIn = document.getElementById('clockIn');
  const clockOut = document.getElementById('clockOut');
  video = document.getElementById('video');
  canvas = document.getElementById('canvas');
  const faceMessage = document.getElementById('faceMessage');
  const faceRecognition = document.getElementById('faceRecognition');
  const message = document.getElementById('message');

  if (navigator.geolocation) {
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        location.textContent = `Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
        const office = getOfficeName(latitude, longitude);
        status.textContent = office ? `At ${office}` : 'Outside office area';
        clockIn.disabled = !office;
        clockOut.disabled = !office;
      },
      (error) => {
        status.textContent = `Error: ${error.message}`;
        clockIn.disabled = true;
        clockOut.disabled = true;
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  } else {
    status.textContent = 'Geolocation not supported';
    clockIn.disabled = true;
    clockOut.disabled = true;
  }

  async function startVideo() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      await faceapi.nets.tinyFaceDetector.loadFromUri('https://unpkg.com/face-api.js/weights');
      await faceapi.nets.faceLandmark68Net.loadFromUri('https://unpkg.com/face-api.js/weights');
      await faceapi.nets.faceRecognitionNet.loadFromUri('https://unpkg.com/face-api.js/weights');
      faceMessage.textContent = 'Please face the camera...';
    } catch (err) {
      faceMessage.textContent = `Error accessing camera: ${err.message}`;
      message.textContent = `Camera error. Try again!`;
      message.className = 'error';
      clockIn.disabled = false;
      clockOut.disabled = false;
    }
  }

  async function captureAndCompare(phone) {
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
    if (detections.length === 0) {
      faceMessage.textContent = 'No face detected. Try again!';
      return false;
    }
    const userFaceDescriptor = detections[0].descriptor;
    // Map phone to username (hardcoded for now)
    const phoneToUsername = {
      '+233247877745': 'user1',
      '+233247877746': 'user2'
    };
    const username = phoneToUsername[phone];
    if (!username) {
      faceMessage.textContent = 'Unknown phone number. Register first!';
      return false;
    }
    const response = await fetch('https://tolon-attendance.proodentit.com/api/attendance/getFaceDescriptor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    const data = await response.json();
    if (!data.success || !data.descriptor) {
      faceMessage.textContent = 'No registered face found.';
      return false;
    }
    const registeredDescriptor = new Float32Array(data.descriptor);
    const distance = faceapi.euclideanDistance(userFaceDescriptor, registeredDescriptor);
    return distance < 0.6; // Adjust threshold as needed
  }

  async function handleClock(action) {
    const status = document.getElementById('status');
    const location = document.getElementById('location');
    const phone = document.getElementById('phone').value;
    if (!phone) {
      message.textContent = 'Please enter
