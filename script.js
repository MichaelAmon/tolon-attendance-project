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
        const isAtOffice = !!office;
        clockIn.disabled = !isAtOffice;
        clockOut.disabled = !isAtOffice;
        clockIn.style.opacity = isAtOffice ? '1' : '0.6';
        clockOut.style.opacity = isAtOffice ? '1' : '0.6';
      },
      (error) => {
        status.textContent = `Error: ${error.message}`;
        clockIn.disabled = true;
        clockOut.disabled = true;
        clockIn.style.opacity = '0.6';
        clockOut.style.opacity = '0.6';
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  } else {
    status.textContent = 'Geolocation not supported';
    clockIn.disabled = true;
    clockOut.disabled = true;
    clockIn.style.opacity = '0.6';
    clockOut.style.opacity = '0.6';
  }

  async function startVideo() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.srcObject = stream;
      video.play();
      video.style.transform = 'scaleX(-1)';
      faceMessage.textContent = 'Please face the camera...';
    } catch (err) {
      console.error('Camera/video error:', err);
      faceMessage.textContent = 'Camera error. Try again.';
      popupHeader.textContent = 'Verification Unsuccessful';
      popupMessage.textContent = `Camera error. Try again. Details: ${err.name} - ${err.message}.`;
      popupFooter.textContent = `${new Date().toLocaleDateString('en-US', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`;
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

  async function validateFace(imageData) {
    const apiKey = '4f4766d9-fc3b-436a-b24e-f57851a1c865'; // Should be moved to .env or fetched from backend
    const url = 'https://tolon-attendance.proodentit.com:3001/api/proxy/face-recognition';
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-api-key
