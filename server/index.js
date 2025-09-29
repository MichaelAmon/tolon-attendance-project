const express = require('express');
const cors = require('cors');
const { GoogleSpreadsheet } = require('google-spreadsheet');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('../')); // Serve index.html, style.css, script.js

// Attendance API
app.post('/api/attendance/web', async (req, res) => {
  try {
    const { action, latitude, longitude, timestamp, subjectId } = req.body;
    const doc = new GoogleSpreadsheet(process.env.ATTENDANCE_SHEET_ID);
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.addRow({
      Action: action,
      Latitude: latitude,
      Longitude: longitude,
      Timestamp: timestamp,
      SubjectId: subjectId,
    });
    res.json({ success: true, message: `Successfully ${action}ed` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Placeholder for face recognition proxy (implement or remove based on needs)
app.post('/api/proxy/face-recognition', (req, res) => {
  res.status(501).json({ error: 'Face recognition proxy not implemented' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
