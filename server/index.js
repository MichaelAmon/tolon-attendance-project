const express = require('express');
     const cors = require('cors');
     const { GoogleSpreadsheet } = require('google-spreadsheet');
     const { JWT } = require('google-auth-library');
     const fetch = require('node-fetch');
     require('dotenv').config();

     const app = express();
     app.use(cors({ origin: 'https://tolon-attendance.proodentit.com' }));
     app.use(express.json());

     const OFFICE_LOCATIONS = [
       { name: 'Head Office', lat: 9.429241474535132, long: -1.0533786340817441, radius: 0.15 },
       { name: 'Nyankpala', lat: 9.404691157748209, long: -0.9838639320946208, radius: 0.15 }
     ];

     function getDistance(lat1, lon1, lat2, lon2) {
       const R = 6371;
       const dLat = (lat2 - lat1) * Math.PI / 180;
       const dLon = (lon2 - lon1) * Math.PI / 180;
       const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                 Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                 Math.sin(dLon / 2) * Math.sin(dLon / 2);
       const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
       return R * c;
     }

     function getOfficeName(lat, long) {
       return OFFICE_LOCATIONS.find(office => getDistance(lat, long, office.lat, office.long) <= office.radius)?.name || null;
     }

     app.post('/api/attendance/web', async (req, res) => {
       const { action, latitude, longitude, timestamp, subjectId } = req.body;
       try {
         // Validate location
         const office = getOfficeName(latitude, longitude);
         if (!office) {
           return res.status(400).json({ success: false, message: 'Outside allowed office area' });
         }

         // Connect to Google Sheet
         const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
         const serviceAccountAuth = new JWT({
           email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
           key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
           scopes: ['https://www.googleapis.com/auth/spreadsheets'],
         });
         await doc.useServiceAccountAuth(serviceAccountAuth);
         await doc.loadInfo();

         // Check Staff sheet
         const staffSheet = doc.sheetsByTitle['Staff'];
         const staffRows = await staffSheet.getRows();
         const staff = staffRows.find(row => row.get('Name') === subjectId);
         if (!staff) {
           return res.status(400).json({ success: false, message: 'Staff member not found' });
         }
         if (staff.get('Active') !== 'Yes') {
           return res.status(400).json({ success: false, message: 'Staff member is not active' });
         }
         const allowedLocations = staff.get('Allowed Locations')?.split(',').map(loc => loc.trim());
         if (!allowedLocations.includes(office)) {
           return res.status(400).json({ success: false, message: `Not allowed at ${office}` });
         }

         // Log to Attendance sheet
         const attendanceSheet = doc.sheetsByTitle['Attendance'];
         const attendanceRows = await attendanceSheet.getRows();
         const today = new Date(timestamp).toISOString().split('T')[0];
         const existingEntry = attendanceRows.find(row => 
           row.get('Name') === subjectId && 
           row.get(action === 'clock in' ? 'Time In' : 'Time Out')?.startsWith(today)
         );

         if (existingEntry) {
           return res.status(400).json({ success: false, message: `Already ${action} today` });
         }

         const newEntry = {
           Name: subjectId,
           Department: staff.get('Department'),
           Location: office,
           ...(action === 'clock in' ? { 'Time In': timestamp } : { 'Time Out': timestamp })
         };
         await attendanceSheet.addRow(newEntry);

         res.json({ success: true, message: `${action} successful` });
       } catch (error) {
         console.error('Attendance error:', error);
         res.status(500).json({ success: false, message: `Server error: ${error.message}` });
       }
     });

     app.post('/api/proxy/face-recognition', async (req, res) => {
       try {
         const response = await fetch('http://server.proodentit.com:8081/api/v1/recognition/recognize', {
           method: 'POST',
           headers: {
             'x-api-key': '4f4766d9-fc3b-436a-b24e-f57851a1c865',
             'Content-Type': 'application/json'
           },
           body: JSON.stringify(req.body)
         });
         if (!response.ok) {
           throw new Error(`CompreFace API error: ${response.status}`);
         }
         const data = await response.json();
         res.json(data);
       } catch (error) {
         console.error('CompreFace proxy error:', error);
         res.status(500).json({ success: false, message: `CompreFace error: ${error.message}` });
       }
     });

     const PORT = process.env.PORT || 3001;
     app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
