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
let isLoggedIn = false;
let video, canvas, faceMatcher;

async function startLocationWatch() {
  const status = document.getElementById('status');
  const location = document.getElementById('location');
  const clockIn = document.getElementById('clockIn');
  const clockOut = document.getElementById('clockOut');
  const loginSection = document.getElementById('loginSection');
  const attendanceSection = document.getElementById('attendanceSection');
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
        if (isLoggedIn) {
          clockIn.disabled = !office;
          clockOut.disabled = !office;
        }
      },
      (error) => {
        status.textContent = `Error: ${error.message}`;
        if (isLoggedIn) {
          clockIn.disabled = true;
          clockOut.disabled = true;
        }
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  } else {
    status.textContent = 'Geolocation not supported';
    if (isLoggedIn) {
      clockIn.disabled = true;
      clockOut.disabled = true;
    }
  }

  document.getElementById('login').addEventListener('click', async () => {
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginMessage = document.getElementById('loginMessage');

    try {
      const response = await fetch('https://tolon-attendance.proodentit.com/api/attendance/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json();
      loginMessage.textContent = data.message;
      if (data.success) {
        isLoggedIn = true;
        loginSection.style.display = 'none';
        attendanceSection.style.display = 'block';
        loginMessage.className = '';
      } else {
        loginMessage.className = 'error';
      }
    } catch (error) {
      loginMessage.textContent = `Error: ${error.message}. Try again!`;
      loginMessage.className = 'error';
    }
  });

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

  async function captureAndCompare(username) {
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
    if (detections.length === 0) {
      faceMessage.textContent = 'No face detected. Try again!';
      return false;
    }
    const userFaceDescriptor = detections[0].descriptor;
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
    if (!isLoggedIn) {
      message.textContent = 'Please log in first!';
      return;
    }
    const status = document.getElementById('status');
    const location = document.getElementById('location');
    const phone = document.getElementById('phone').value;
    const username = document.getElementById('username').value; // Use logged-in username
    if (!phone) {
      message.textContent = 'Please enter your phone';
      message.className = 'error';
      return;
    }
    const [latStr, lonStr] = location.textContent.replace('Location: ', '').split(', ');
    const latitude = parseFloat(latStr);
    const longitude = parseFloat(lonStr);
    if (isNaN(latitude) || isNaN(longitude)) {
      message.textContent = 'Location not loaded yet. Try again!';
      message.className = 'error';
      return;
    }
    status.textContent = `Processing ${action}...`;
    clockIn.disabled = true;
    clockOut.disabled = true;
    faceRecognition.style.display = 'block';
    await startVideo();

    // Automatically capture and compare after a short delay
    setTimeout(async () => {
      const isMatch = await captureAndCompare(username);
      if (isMatch) {
        faceRecognition.style.display = 'none';
        try {
          const response = await fetch('https://tolon-attendance.proodentit.com/api/attendance/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              phone,
              action,
              latitude,
              longitude,
              timestamp: new Date().toISOString()
            })
          });
          const data = await response.json();
          message.textContent = data.message;
          message.className = data.success ? '' : 'error';
          if (!data.success) {
            clockIn.disabled = false;
            clockOut.disabled = false;
          }
        } catch (error) {
          message.textContent = `Error: ${error.message}. Try again!`;
          message.className = 'error';
          clockIn.disabled = false;
          clockOut.disabled = false;
        }
      } else {
        faceMessage.textContent = 'Face does not match. Access denied!';
        message.textContent = 'Facial recognition failed. Try again!';
        message.className = 'error';
        clockIn.disabled = false;
        clockOut.disabled = false;
        if (video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
        faceRecognition.style.display = 'none';
      }
    }, 3000); // 3-second delay to allow user to face the camera
  }

  document.getElementById('clockIn').addEventListener('click', () => handleClock('clock in'));
  document.getElementById('clockOut').addEventListener('click', () => handleClock('clock out'));
}

// Start location watch when page loads
window.onload = startLocationWatch;

// Clean up on page unload
window.onunload = () => {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  if (video && video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
};
