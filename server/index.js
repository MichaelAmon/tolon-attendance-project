import express from 'express';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import 'dotenv/config';

const app = express();
app.use(express.json());

const PORT = process.env.WEB_PORT || 3001;

const rawKey = process.env.GOOGLE_PRIVATE_KEY;
const processedKey = rawKey
  .replace(/\\\\n/g, '\n')
  .replace(/\\n/g, '\n');
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: processedKey,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const OFFICE_LOCATIONS = [
  { name: 'Head Office', lat: 9.429241474535132, long: -1.0533786340817441, radius: 0.1 },
  { name: 'Nyankpala', lat: 9.404691157748209, long: -0.9838639320946208, radius: 0.1 }
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

app.post('/api/attendance/web', async (req, res) => {
  const { phone, action, latitude, longitude, timestamp } = req.body;
  console.log(`📥 Web attendance request: ${action} from ${phone}, ${latitude}, ${longitude}`);

  if (!phone || !action || isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({ success: false, message: 'Invalid input 🚫. Please try again!' });
  }

  try {
    const attendanceDoc = new GoogleSpreadsheet(process.env.ATTENDANCE_SHEET_ID, serviceAccountAuth);
    await attendanceDoc.loadInfo();
    const attendanceSheet = attendanceDoc.sheetsByTitle['Attendance Sheet'];
    const dateStr = new Date(timestamp).toISOString().split('T')[0];
    const rows = await attendanceSheet.getRows();
    const userRow = rows.find(row => row.get('Phone') === phone && row.get('Time In')?.startsWith(dateStr));

    if (action === 'clock in' && userRow && userRow.get('Time In')) {
      return res.json({ success: false, message: 'You have already clocked in today ✅.' });
    }
    if (action === 'clock out' && (!userRow || !userRow.get('Time In') || userRow.get('Time Out'))) {
      return res.json({ success: false, message: 'No clock-in found for today ⏰ or already clocked out ✅.' });
    }

    const officeName = getOfficeName(latitude, longitude);
    if (!officeName) {
      return res.json({ success: false, message: 'Invalid location 🚫. Please try again from an office 📍!' });
    }

    if (action === 'clock in') {
      await attendanceSheet.addRow({
        Name: 'Web User', // Update with staff lookup if needed
        Phone: phone,
        'Time In': timestamp,
        'Time Out': '',
        Location: officeName,
        Department: 'Web'
      });
      return res.json({ success: true, message: `Clocked in successfully 🎉 at ${timestamp} at ${officeName} 📍!` });
    } else if (action === 'clock out') {
      if (userRow) {
        userRow.set('Time Out', timestamp);
        userRow.set('Location', officeName);
        await userRow.save();
        return res.json({ success: true, message: `Clocked out successfully 🎉 at ${timestamp} at ${officeName} 📍!` });
    }
  } catch (error) {
    console.error('❌ Web attendance error:', error.message);
    return res.status(500).json({ success: false, message: `Server error 😞. Please try again or contact admin 📞!` });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎉 Web attendance server running on http://0.0.0.0:${PORT}`);
});