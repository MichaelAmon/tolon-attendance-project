// index.js for Tolon Attendance System

(async () => {
  const express = require('express');
  const cors = require('cors');
  const dotenv = require('dotenv');
  const { GoogleSpreadsheet } = await import('google-spreadsheet');

  // Load environment variables
  dotenv.config();

  // Initialize Express app
  const app = express();
  app.use(express.json());
  app.use(cors());
  app.use(express.static('client')); // Serve static files from client folder

  // Google Sheets authentication
  const doc = new GoogleSpreadsheet(process.env.ATTENDANCE_SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
  await doc.loadInfo(); // Load sheet info

  // API Endpoint: Handle attendance (e.g., clock in/out)
  app.post('/api/attendance/web', async (req, res) => {
    try {
      const { action, latitude, longitude, timestamp, subjectId } = req.body;

      if (!action || !latitude || !longitude || !timestamp || !subjectId) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const sheet = doc.sheetsByIndex[0]; // Use the first sheet
      const newRow = await sheet.addRow({
        action,
        latitude,
        longitude,
        timestamp,
        subjectId,
        date: new Date().toISOString().split('T')[0],
      });

      res.status(200).json({ message: 'Attendance recorded', row: newRow._rawData });
    } catch (error) {
      console.error('Error recording attendance:', error);
      res.status(500).json({ error: 'Failed to record attendance' });
    }
  });

  // CompreFace Integration (example endpoint)
  app.post('/api/recognize', async (req, res) => {
    try {
      const { image } = req.body;
      // Placeholder: Integrate with CompreFace at http://145.223.33.154:8081
      res.status(200).json({ message: 'Recognition pending', image });
    } catch (error) {
      res.status(500).json({ error: 'Recognition failed' });
    }
  });

  // Start server
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
})();

// Cleanup on shutdown (using beforeunload alternative)
process.on('beforeExit', () => {
  console.log('Server shutting down...');
  // Add cleanup logic if needed (e.g., close database connections)
});
