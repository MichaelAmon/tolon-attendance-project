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
let video, canvas, popup, popupHeader, popupMessage, popupFooter;

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
  popup = document.getElementById('popup');
  popupHeader = document.getElementById('popupHeader');
  popupMessage = document.getElementById('popupMessage');
  popupFooter = document.getElementById('popupFooter');

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

  async function captureAndCompare() {
    const displaySize = { width: video.width, height: video.height };
    faceapi.matchDimensions(canvas, displaySize);
    const detections = await faceapi.detectAllFaces(video, new faceapi.TinyFaceDetectorOptions()).withFaceLandmarks().withFaceDescriptors();
    if (detections.length === 0) {
      faceMessage.textContent = 'No face detected. Try again!';
      return { success: false, name: null };
    }
    const userFaceDescriptor = detections[0].descriptor;
    // Map usernames to names (hardcoded for now)
    const userMap = {
      'user1': 'John Doe',
      'user2': 'Jane Smith'
    };
    const response = await fetch('https://tolon-attendance.proodentit.com/api/attendance/getFaceDescriptor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: Object.keys(userMap).find(key => userMap[key] === 'John Doe') || 'user1' }) // Default to first user
    });
    const data = await response.json();
    if (!data.success || !data.descriptor) {
      faceMessage.textContent = 'No registered face found.';
      return { success: false, name: null };
    }
    const registeredDescriptor = new Float32Array(data.descriptor);
    const distance = faceapi.euclideanDistance(userFaceDescriptor, registeredDescriptor);
    const username = Object.keys(userMap).find(key => data.descriptor === faceDescriptors[key]);
    return { success: distance < 0.6, name: username ? userMap[username] : null }; // Adjust threshold as needed
  }

  async function handleClock(action) {
    const status = document.getElementById('status');
    const location = document.getElementById('location');
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
      const result = await captureAndCompare();
      if (result.success && result.name) {
        faceRecognition.style.display = 'none';
        popupHeader.textContent = 'Verification Successful';
        popupMessage.textContent = `Thank you ${result.name}, you have ${action} successfully at ${new Date().toLocaleTimeString()}`;
        popupFooter.textContent = `Clocked ${action.replace(' ', '')} Date: ${new Date().toLocaleDateString()}`;
        popup.style.display = 'block';
        setTimeout(() => {
          popup.style.display = 'none';
          clockIn.disabled = false;
          clockOut.disabled = false;
        }, 3000); // Auto-close popup after 3 seconds
        try {
          const response = await fetch('https://tolon-attendance.proodentit.com/api/attendance/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action,
              latitude,
              longitude,
              timestamp: new Date().toISOString()
            })
          });
          const data = await response.json();
          if (!data.success) {
            message.textContent = data.message;
            message.className = 'error';
          }
        } catch (error) {
          message.textContent = `Error: ${error.message}. Try again!`;
          message.className = 'error';
        }
      } else {
        faceRecognition.style.display = 'none';
        popupHeader.textContent = 'Verification Unsuccessful';
        popupMessage.textContent = 'Facial recognition failed. Please try again!';
        popupFooter.textContent = `Clocked ${action.replace(' ', '')} Date: ${new Date().toLocaleDateString()}`;
        popup.style.display = 'block';
        setTimeout(() => {
          popup.style.display = 'none';
          clockIn.disabled = false;
          clockOut.disabled = false;
        }, 3000); // Auto-close popup after 3 seconds
        if (video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
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
