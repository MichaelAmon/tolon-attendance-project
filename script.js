// Office locations (match your server config)
const OFFICE_LOCATIONS = [
  { name: 'Head Office', lat: 9.429241474535132, long: -1.0533786340817441, radius: 0.1 },
  { name: 'Nyankpala', lat: 9.404691157748209, long: -0.9838639320946208, radius: 0.1 }
];

function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius (km)
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

async function startLocationWatch() {
  const status = document.getElementById('status');
  const location = document.getElementById('location');
  const clockIn = document.getElementById('clockIn');
  const clockOut = document.getElementById('clockOut');

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
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
    );
  } else {
    status.textContent = 'Geolocation not supported';
    clockIn.disabled = true;
    clockOut.disabled = true;
  }
}

async function handleClock(action) {
  const status = document.getElementById('status');
  const location = document.getElementById('location');
  const phone = document.getElementById('phone').value;
  if (!phone) {
    status.textContent = 'Please enter your phone';
    return;
  }
  const [latStr, lonStr] = location.textContent.replace('Location: ', '').split(', ');
  const latitude = parseFloat(latStr);
  const longitude = parseFloat(lonStr);
  status.textContent = `Processing ${action}...`;
  clockIn.disabled = true;
  clockOut.disabled = true;

  try {
    const response = await fetch('https://att.proodentit.com/api/attendance', {
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
    status.textContent = data.message;
    if (!data.success) {
      clockIn.disabled = false;
      clockOut.disabled = false;
    }
  } catch (error) {
    status.textContent = `Error: ${error.message}`;
    clockIn.disabled = false;
    clockOut.disabled = false;
  }
}

document.getElementById('clockIn').addEventListener('click', () => handleClock('clock in'));
document.getElementById('clockOut').addEventListener('click', () => handleClock('clock out'));

// Start location watch when page loads
window.onload = startLocationWatch;