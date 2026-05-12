import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import { z } from 'zod';
import { format, subHours, subDays, startOfDay } from 'date-fns';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const VITE_KEY = (process.env.VITE_GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim();
console.log('--- Environment Diagnostic ---');
console.log('CWD:', process.cwd());
console.log('VITE_GEMINI_API_KEY length:', VITE_KEY.length);
if (VITE_KEY) {
  console.log('Key Format Check:', VITE_KEY.startsWith('AIza') ? 'Valid prefix' : 'Invalid prefix');
}
console.log('------------------------------');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const JWT_SECRET = process.env.JWT_SECRET || 'bms-secret-key-123';

declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Initialize Database
const db = new Database('bms.db');
db.pragma('journal_mode = WAL');

// Initial Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'admin'
  );

  CREATE TABLE IF NOT EXISTS buildings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    address TEXT,
    total_floors INTEGER
  );

  CREATE TABLE IF NOT EXISTS floors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_id INTEGER,
    floor_number INTEGER,
    FOREIGN KEY(building_id) REFERENCES buildings(id)
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    floor_id INTEGER,
    name TEXT,
    FOREIGN KEY(floor_id) REFERENCES floors(id)
  );

  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER,
    name TEXT,
    type TEXT,
    status TEXT DEFAULT 'OFF',
    current_power REAL DEFAULT 0,
    daily_energy REAL DEFAULT 0,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(room_id) REFERENCES rooms(id)
  );

  CREATE TABLE IF NOT EXISTS device_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER,
    power_kw REAL,
    occupancy INTEGER DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(device_id) REFERENCES devices(id)
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER,
    severity TEXT,
    message TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'UNREAD',
    suggested_action TEXT,
    FOREIGN KEY(device_id) REFERENCES devices(id)
  );

  CREATE TABLE IF NOT EXISTS recommendations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER,
    category TEXT,
    recommendation TEXT,
    potential_savings REAL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(device_id) REFERENCES devices(id)
  );

  CREATE TABLE IF NOT EXISTS automation_actions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id INTEGER,
    action TEXT,
    triggered_by TEXT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(device_id) REFERENCES devices(id)
  );

  CREATE TABLE IF NOT EXISTS energy_predictions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    building_id INTEGER,
    predicted_consumption REAL,
    predicted_cost REAL,
    target_date DATE,
    FOREIGN KEY(building_id) REFERENCES buildings(id)
  );
`);

// Seed Admin User
const seedUser = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
if (!seedUser) {
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO users (username, password, role) VALUES (?, ?, ?)').run('admin', hashedPassword, 'admin');
}

// Seed Data Generator
function seedInitialData() {
  const count = db.prepare('SELECT COUNT(*) as count FROM buildings').get() as any;
  if (count.count > 0) return;

  const buildingId = db.prepare('INSERT INTO buildings (name, address, total_floors) VALUES (?, ?, ?)').run('Main Campus Complex (BDG2 Inspired)', 'Academic District, Science Park', 12).lastInsertRowid;
  
  const categories = ['Education', 'Office', 'Healthcare', 'Lodging', 'Public Assembly'];
  const floorTypes = ['Laboratory', 'Lecture Hall', 'Administrative', 'Dormitory', 'Operating Room'];

  for (let f = 1; f <= 8; f++) {
    const floorId = db.prepare('INSERT INTO floors (building_id, floor_number) VALUES (?, ?)').run(buildingId, f).lastInsertRowid;
    const cat = categories[f % categories.length];
    
    for (let r = 1; r <= 3; r++) {
      const roomName = `${cat} ${f}0${r}`;
      const roomId = db.prepare('INSERT INTO rooms (floor_id, name) VALUES (?, ?)').run(floorId, roomName).lastInsertRowid;
      
      const devices = [
        { name: 'Chilled Water Loop', type: 'HVAC', p: 15.5 },
        { name: 'Primary Electricity Meter', type: 'METER', p: 65.0 },
        { name: 'Hot Water Pump', type: 'PUMP', p: 4.2 },
        { name: 'Smart LED Grid', type: 'LIGHTING', p: 1.8 },
        { name: 'Steam Valve Controller', type: 'HVAC', p: 0.5 }
      ];

      devices.forEach(d => {
        const status = Math.random() > 0.2 ? 'ON' : 'OFF';
        const currentPower = status === 'ON' ? d.p * (0.7 + Math.random() * 0.6) : 0;
        const devId = db.prepare('INSERT INTO devices (room_id, name, type, status, current_power) VALUES (?, ?, ?, ?, ?)').run(roomId, d.name, d.type, status, currentPower).lastInsertRowid;
        
        // Generate historical logs for the last 24 hours
        const stmt = db.prepare('INSERT INTO device_logs (device_id, power_kw, occupancy, timestamp) VALUES (?, ?, ?, ?)');
        for (let h = 0; h < 48; h++) {
          const timestamp = format(subHours(new Date(), h), 'yyyy-MM-dd HH:mm:ss');
          let multiplier = 0.5 + Math.random() * 0.5;
          // Simulate day/night cycles typical in BDG2
          const hour = (24 - h % 24) % 24;
          if (hour < 7 || hour > 19) multiplier *= 0.3; // Night low usage
          
          const p = d.p * multiplier;
          const occ = multiplier > 0.4 ? 1 : 0;
          stmt.run(devId, p, occ, timestamp);
        }
      });
    }
  }

  // Seed some alerts
  const devList = db.prepare('SELECT id, name FROM devices LIMIT 5').all() as any[];
  if (devList.length > 0) {
    const alerts = [
      { id: devList[0].id, s: 'Critical', m: 'Unusually high power draw detected in Chilled Water Loop.', a: 'Check compressor for mechanical failure.' },
      { id: devList[1].id, s: 'High', m: 'Meter anomaly: Consumption spiked 400% in 5 minutes.', a: 'Inspect current transformers.' },
      { id: devList[2].id, s: 'Medium', m: 'Smart LED Grid reporting 15% faulty nodes.', a: 'Dispatch maintenance to Floor 3 West.' }
    ];
    const alertStmt = db.prepare('INSERT INTO alerts (device_id, severity, message, suggested_action) VALUES (?, ?, ?, ?)');
    alerts.forEach(a => alertStmt.run(a.id, a.s, a.m, a.a));
  }
}

seedInitialData();

// Server-side AI response cache: keyed by prompt, expires after 10 minutes
const aiCache = new Map<string, { text: string; expiresAt: number }>();
const AI_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Config Route
  app.get('/api/config', (req, res) => {
    const key = (process.env.VITE_GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim();
    res.json({
      geminiApiKey: key
    });
  });

  // API Routes
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
    
    if (user && bcrypt.compareSync(password, user.password)) {
      const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
      res.json({ token, user: { username: user.username, role: user.role } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  const authenticateToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
      if (err) return res.sendStatus(403);
      req.user = user;
      next();
    });
  };

  // AI Proxy Route — runs Gemini server-side (avoids CORS) with response caching
  app.post('/api/ai/generate', authenticateToken, async (req: any, res: any) => {
    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt is required' });
    }
    const apiKey = (process.env.VITE_GEMINI_API_KEY || '').replace(/^["']|["']$/g, '').trim();
    if (!apiKey || !apiKey.startsWith('AIza')) {
      return res.status(500).json({ error: 'Gemini API key not configured on server' });
    }

    // Check cache first
    const cached = aiCache.get(prompt);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ text: cached.text, cached: true });
    }

    try {
      const genai = new GoogleGenAI({ apiKey });
      const result = await genai.models.generateContent({
        model: 'gemini-2.0-flash-lite',
        contents: prompt,
      });
      const text = result.text ?? '';
      // Store in cache
      aiCache.set(prompt, { text, expiresAt: Date.now() + AI_CACHE_TTL_MS });
      res.json({ text });
    } catch (err: any) {
      const errBody = err?.message || '';
      // Try to extract retryDelay from 429 response
      let retryAfter: number | undefined;
      try {
        const parsed = JSON.parse(errBody);
        const retryInfo = parsed?.error?.details?.find((d: any) => d['@type']?.includes('RetryInfo'));
        if (retryInfo?.retryDelay) {
          retryAfter = parseInt(retryInfo.retryDelay);
        }
      } catch {}
      const statusCode = err?.status === 'RESOURCE_EXHAUSTED' || errBody.includes('429') ? 429 : 500;
      console.error('Gemini API error:', errBody);
      res.status(statusCode).json({
        error: statusCode === 429
          ? `Rate limit reached. Please retry in ${retryAfter ?? 60} seconds.`
          : (errBody || 'AI generation failed'),
        retryAfter,
      });
    }
  });

  app.get('/api/dashboard/summary', authenticateToken, (req, res) => {
    const activeDevices = db.prepare("SELECT COUNT(*) as count FROM devices WHERE status = 'ON'").get() as any;
    const totalPower = db.prepare("SELECT SUM(current_power) as total FROM devices WHERE status = 'ON'").get() as any;
    
    // Last 24h consumption
    const last24h = db.prepare(`
      SELECT SUM(power_kw) / 60 as consumption 
      FROM device_logs 
      WHERE timestamp >= datetime('now', '-24 hours')
    `).get() as any;

    res.json({
      activeDevices: activeDevices.count,
      currentPowerDemand: totalPower.total || 0,
      totalEnergyToday: last24h.consumption || 0,
      estimatedCost: (last24h.consumption || 0) * 0.15, // $0.15 per kWh
      carbonEmissions: (last24h.consumption || 0) * 0.4, // 0.4kg CO2 per kWh
      wastePercentage: Math.floor(Math.random() * 15) + 5 // Simulated waste
    });
  });

  app.get('/api/devices', authenticateToken, (req, res) => {
    const devices = db.prepare(`
      SELECT d.*, r.name as room_name, f.floor_number, b.name as building_name
      FROM devices d
      JOIN rooms r ON d.room_id = r.id
      JOIN floors f ON r.floor_id = f.id
      JOIN buildings b ON f.building_id = b.id
    `).all();
    res.json(devices);
  });

  app.get('/api/alerts', authenticateToken, (req, res) => {
    const alerts = db.prepare(`
      SELECT a.*, d.name as device_name 
      FROM alerts a 
      JOIN devices d ON a.device_id = d.id 
      ORDER BY a.timestamp DESC
    `).all();
    res.json(alerts);
  });

  app.get('/api/recommendations', authenticateToken, (req, res) => {
    const recs = db.prepare(`
      SELECT r.*, d.name as device_name 
      FROM recommendations r 
      JOIN devices d ON r.device_id = d.id 
      ORDER BY r.timestamp DESC
    `).all();
    res.json(recs);
  });

  app.post('/api/automation/action', authenticateToken, (req, res) => {
    const { deviceId, action } = req.body;
    db.prepare('UPDATE devices SET status = ?, last_active = CURRENT_TIMESTAMP WHERE id = ?').run(action, deviceId);
    db.prepare('INSERT INTO automation_actions (device_id, action, triggered_by) VALUES (?, ?, ?)').run(deviceId, action, req.user.username);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`BMS Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n❌ Port ${PORT} is already in use.`);
      console.error(`   Run this to fix it: npx kill-port ${PORT}`);
      console.error(`   Or in PowerShell:   Stop-Process -Id (netstat -ano | Select-String ":${PORT} " | ForEach-Object { ($_ -split "\\s+")[-1] }) -Force\n`);
      process.exit(1);
    } else {
      throw err;
    }
  });
}

startServer();
