
import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs/promises';
import { nanoid } from 'nanoid';

const PORT = 3000;
const DB_PATH = path.join(process.cwd(), 'db.json');

interface Event {
  id: string;
  title: string;
  type: 'class' | 'exam' | 'assignment' | 'other';
  date: string; // ISO string
  description?: string;
  location?: string;
}

interface Group {
  id: string;
  name: string;
  code: string;
  events: Event[];
}

interface DB {
  groups: Group[];
}

async function ensureDB() {
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify({ groups: [] }, null, 2));
  }
}

async function readDB(): Promise<DB> {
  const data = await fs.readFile(DB_PATH, 'utf-8');
  return JSON.parse(data);
}

async function writeDB(db: DB) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
}

async function startServer() {
  await ensureDB();
  const app = express();
  app.use(express.json());

  // API Routes
  app.get('/api/groups', async (req, res) => {
    const db = await readDB();
    res.json(db.groups);
  });

  app.post('/api/groups', async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    
    const db = await readDB();
    const newGroup: Group = {
      id: nanoid(),
      name,
      code: nanoid(6).toUpperCase(),
      events: []
    };
    db.groups.push(newGroup);
    await writeDB(db);
    res.status(201).json(newGroup);
  });

  app.get('/api/groups/:code', async (req, res) => {
    const { code } = req.params;
    const db = await readDB();
    const group = db.groups.find(g => g.code === code.toUpperCase());
    if (!group) return res.status(404).json({ error: 'Group not found' });
    res.json(group);
  });

  app.post('/api/groups/:id/events', async (req, res) => {
    const { id } = req.params;
    const { title, type, date, description, location } = req.body;
    
    const db = await readDB();
    const groupIndex = db.groups.findIndex(g => g.id === id);
    if (groupIndex === -1) return res.status(404).json({ error: 'Group not found' });

    const newEvent: Event = {
      id: nanoid(),
      title,
      type,
      date,
      description,
      location
    };

    db.groups[groupIndex].events.push(newEvent);
    await writeDB(db);
    res.status(201).json(newEvent);
  });

  // Vite Middleware
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

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
