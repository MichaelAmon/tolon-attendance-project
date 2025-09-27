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
let video, canvas, popup, popupHeader, popupMessage, popupFooter, popupRetry, diagnostic;

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
  popupRetry = document.getElementById('popupRetry');
  diagnostic = document.getElementById('diagnostic');

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
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.srcObject = stream;
      video.play();
      // Un-mirror the video feed
      video.style.transform = 'scaleX(-1)';
      faceMessage.textContent = 'Please face the camera...';
    } catch (err) {
      console.error('Camera/video error:', err);
      faceMessage.textContent = 'Camera error. Try again.';
      popupHeader.textContent = 'Verification Unsuccessful';
      popupMessage.textContent = `Camera error. Try again. Details: ${err.name} - ${err.message}.`;
      popupFooter.textContent = `Clocked In/Out Date: ${new Date().toLocaleDateString()}`;
      popupRetry.innerHTML = '<button onclick="retryCamera()">Retry Camera</button>';
      popup.style.display = 'block';
      clockIn.disabled = false;
      clockOut.disabled = false;
      faceRecognition.style.display = 'none';
      if (video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
    }
  }

  window.retryCamera = async () => {
    popup.style.display = 'none';
    faceRecognition.style.display = 'block';
    await startVideo();
  };

  // Function to validate face using CompreFace API
  async function validateFace(imageData) {
    const apiKey = '4f4766d9-fc3b-436a-b24e-f57851a1c865'; // Your API key
    const url = 'http://145.223.33.154:8081/api/v1/recognition/recognize'; // Your server IP and port
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });
      const result = await response.json();
      if (result.result && result.result.length > 0) {
        return result.result[0].subject; // Returns the matched Subject Name
      }
      return null; // No match found
    } catch (error) {
      console.error('Face recognition error:', error);
      return null;
    }
  }

  // Updated function to capture and compare using CompreFace
  async function captureAndCompare() {
    const canvas = document.createElement('canvas');
    canvas.width = 640; // Reverted to original size
    canvas.height = 480;
    const context = canvas.getContext('2d');
    // Flip the context to match the un-mirrored video
    context.scale(-1, 1);
    context.drawImage(video, -canvas.width, 0, canvas.width, canvas.height); // Draw from the right
    const imageData = canvas.toDataURL('image/jpeg').split(',')[1]; // Base64 without prefix
    const subjectId = await validateFace(imageData);
    return { success: !!subjectId, name: subjectId ? subjectId : null }; // Return the Subject Name directly
  }

  async function handleClock(action) {
    const status = document.getElementById('status');
    const location = document.getElementById('location');
    const clockIn = document.getElementById('clockIn');
    const clockOut = document.getElementById('clockOut');
    const message = document.getElementById('message');
    const faceRecognition = document.getElementById('faceRecognition');

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

    setTimeout(async () => {
      const faceMessage = document.getElementById('faceMessage');
      if (faceMessage.textContent === 'Camera error. Try again.') return;
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
        }, 5000);
        try {
          const response = await fetch('https://tolon-attendance.proodentit.com/api/attendance/web', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action,
              latitude,
              longitude,
              timestamp: new Date().toISOString(),
              subjectId: result.name // Use the Subject Name directly
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
        }, 5000);
        if (video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
      }
    }, 3000); // Reverted to original 3-second delay
  }

  document.getElementById('clockIn').addEventListener('click', () => handleClock('clock in'));
  document.getElementById('clockOut').addEventListener('click', () => handleClock('clock out'));
}

// Ensure script runs when page loads
window.onload = startLocationWatch;

window.onunload = () => {
  if (watchId) navigator.geolocation.clearWatch(watchId);
  if (video && video.srcObject) video.srcObject.getTracks().forEach(track => track.stop());
};
