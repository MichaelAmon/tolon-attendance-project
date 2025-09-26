import express from 'express';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import 'dotenv/config';
import path from 'path';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors({ origin: 'https://tolon-attendance.proodentit.com' }));
app.use(express.static(path.join(__dirname, '..')));

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

// Placeholder face descriptors
const faceDescriptors = {
  'user1': [0.1, 0.2, 0.3, /* ... */], // Example descriptor
  'user2': [0.4, 0.5, 0.6, /* ... */]  // Example descriptor
};

app.post('/api/attendance/getFaceDescriptor', (req, res) => {
  const { username } = req.body;
  if (faceDescriptors[username]) {
    res.json({ success: true, descriptor: faceDescriptors[username] });
  } else {
    res.json({ success: false, message: 'No face data for this user' });
  }
});

app.post('/api/attendance/web', async (req, res) => {
  const { action, latitude, longitude, timestamp } = req.body;
  console.log(`📥 Web attendance request: ${action} at ${latitude}, ${longitude}`);

  if (!action || isNaN(latitude) || isNaN(longitude)) {
    return res.status(400).json({ success: false, message: 'Invalid input. Please try again!' });
  }

  try {
    const attendanceDoc = new GoogleSpreadsheet(process.env.ATTENDANCE_SHEET_ID, serviceAccountAuth);
    await attendanceDoc.loadInfo();
    const attendanceSheet = attendanceDoc.sheetsByTitle['Attendance Sheet'];
    const dateStr = new Date(timestamp).toISOString().split('T')[0];
    const rows = await attendanceSheet.getRows();
    const userRow = rows.find(row => row.get('Time In')?.startsWith(dateStr));

    if (action === 'clock in' && userRow && userRow.get('Time In')) {
      return res.json({ success: false, message: 'You have already clocked in today.' });
    }
    if (action === 'clock out' && (!userRow || !userRow.get('Time In') || userRow.get('Time Out'))) {
      return res.json({ success: false, message: 'No clock-in found for today or already clocked out.' });
    }

    const officeName = getOfficeName(latitude, longitude);
    if (!officeName) {
      return res.json({ success: false, message: 'Invalid location. Please try again from an office!' });
    }

    if (action === 'clock in') {
      try {
        await attendanceSheet.addRow({
          Name: 'Web User', // Update with actual name from face recognition if needed
          'Time In': timestamp,
          'Time Out': '',
          Location: officeName,
          Department: 'Web'
        });
        console.log('✅ Row added to Attendance Sheet');
        return res.json({ success: true, message: `Clocked in successfully at ${timestamp} at ${officeName}!` });
      } catch (rowError) {
        console.error('❌ Failed to add row:', rowError.message);
        return res.status(500).json({ success: false, message: `Error saving to sheet: ${rowError.message}. Contact admin!` });
      }
    } else if (action === 'clock out') {
      if (userRow) {
        try {
          userRow.set('Time Out', timestamp);
          userRow.set('Location', officeName);
          await userRow.save();
          console.log('✅ Row updated with Time Out');
          return res.json({ success: true, message: `Clocked out successfully at ${timestamp} at ${officeName}!` });
        } catch (rowError) {
          console.error('❌ Failed to update row:', rowError.message);
          return res.status(500).json({ success: false, message: `Error updating sheet: ${rowError.message}. Contact admin!` });
        }
      }
    }
  } catch (error) {
    console.error('❌ Web attendance error:', error.message);
    return res.status(500).json({ success: false, message: `Server error: ${error.message}. Please try again or contact admin!` });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎉 Web attendance server running on http://0.0.0.0:${PORT}`);
});
