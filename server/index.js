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
  'user1': [0.1, 0.2, 0.3, /* ... */], // Example descriptor for +233247877745
  'user2': [0.4, 0.5, 0.6, /* ... 
