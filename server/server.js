const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'schedule-tool-secret-key-2025';
// Use Railway Volume if available, otherwise use local data directory
const DATA_DIR = process.env.RAILWAY_VOLUME_MOUNT_PATH
  ? path.join(process.env.RAILWAY_VOLUME_MOUNT_PATH, 'data')
  : path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');
const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.json');
const PARTICIPANTS_FILE = path.join(DATA_DIR, 'participants.json');

// CORS - allow all origins for now (Render + Vercel setup)
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Ensure data directory and files exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]));
if (!fs.existsSync(EVENTS_FILE)) fs.writeFileSync(EVENTS_FILE, JSON.stringify([]));
if (!fs.existsSync(SUBS_FILE)) fs.writeFileSync(SUBS_FILE, JSON.stringify([]));
if (!fs.existsSync(PARTICIPANTS_FILE)) fs.writeFileSync(PARTICIPANTS_FILE, JSON.stringify([]));

function readUsers() { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8')); }
function writeUsers(users) { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2)); }
function readEvents() { return JSON.parse(fs.readFileSync(EVENTS_FILE, 'utf8')); }
function writeEvents(events) { fs.writeFileSync(EVENTS_FILE, JSON.stringify(events, null, 2)); }
function readSubs() { return JSON.parse(fs.readFileSync(SUBS_FILE, 'utf8')); }
function writeSubs(subs) { fs.writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2)); }
function readParticipants() { return JSON.parse(fs.readFileSync(PARTICIPANTS_FILE, 'utf8')); }
function writeParticipants(parts) { fs.writeFileSync(PARTICIPANTS_FILE, JSON.stringify(parts, null, 2)); }

function getFriends(userId) {
  const subs = readSubs();
  const users = readUsers();
  const friendIds = subs
    .filter(s => s.status === 'accepted' && (s.subscriberId === userId || s.targetId === userId))
    .map(s => s.subscriberId === userId ? s.targetId : s.subscriberId);
  return users.filter(u => friendIds.includes(u.id));
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Register
app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });
  const users = readUsers();
  if (users.find(u => u.username === username)) return res.status(409).json({ error: 'User already exists' });
  const passwordHash = bcrypt.hashSync(password, 10);
  users.push({ id: uuidv4(), username, passwordHash });
  writeUsers(users);
  res.json({ success: true, message: 'Registered' });
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const users = readUsers();
  const user = users.find(u => u.username === username);
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, username: user.username });
});

// Get events in range (owned + participated, excluding declined)
app.get('/api/events', authMiddleware, (req, res) => {
  const { start, end } = req.query;
  const users = readUsers();
  const participants = readParticipants();

  // Events I own
  let events = readEvents().filter(e => e.userId === req.user.userId).map(e => {
    const parts = participants
      .filter(p => p.eventId === e.id)
      .map(p => ({ userId: p.userId, username: users.find(u => u.id === p.userId)?.username || 'unknown', status: p.status }));
    return { ...e, isOwner: true, participants: parts };
  });

  // Events I'm invited to (not declined)
  const myParticipations = participants.filter(p => p.userId === req.user.userId && p.status !== 'declined');
  const allEvents = readEvents();
  const invitedEvents = myParticipations.map(p => {
    const ev = allEvents.find(e => e.id === p.eventId);
    if (!ev) return null;
    // Include all participants for this event
    const parts = participants
      .filter(part => part.eventId === ev.id)
      .map(part => ({ userId: part.userId, username: users.find(u => u.id === part.userId)?.username || 'unknown', status: part.status }));
    return { ...ev, isOwner: false, invitationStatus: p.status, participants: parts };
  }).filter(Boolean);

  events = events.concat(invitedEvents);

  // deduplicate if I'm both owner and participant (edge case)
  const seen = new Set();
  events = events.filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; });

  if (start && end) events = events.filter(e => e.date >= start && e.date <= end);
  res.json(events);
});

// Create event
app.post('/api/events', authMiddleware, (req, res) => {
  const { title, date, time, endTime, description, participants = [] } = req.body;
  if (!title || !date || !time) return res.status(400).json({ error: 'title, date, time required' });
  const events = readEvents();
  const event = { id: uuidv4(), userId: req.user.userId, title, date, time, endTime: endTime || '', description: description || '', createdAt: new Date().toISOString() };
  events.push(event);
  writeEvents(events);

  // Create participant invitations (friends only)
  const friendUsers = getFriends(req.user.userId);
  const parts = readParticipants();
  participants.forEach(uname => {
    const target = friendUsers.find(u => u.username === uname && u.id !== req.user.userId);
    if (target && !parts.find(p => p.eventId === event.id && p.userId === target.id)) {
      parts.push({ id: uuidv4(), eventId: event.id, userId: target.id, invitedBy: req.user.userId, status: 'pending', createdAt: new Date().toISOString() });
    }
  });
  writeParticipants(parts);

  res.json(event);
});

// Update event
app.put('/api/events/:id', authMiddleware, (req, res) => {
  const { title, date, time, endTime, description, participants = [] } = req.body;
  const events = readEvents();
  const idx = events.findIndex(e => e.id === req.params.id && e.userId === req.user.userId);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });
  events[idx] = { ...events[idx], title, date, time, endTime: endTime || '', description: description || '' };
  writeEvents(events);

  // Sync participant list
  const friendUsers = getFriends(req.user.userId);
  let parts = readParticipants();
  const eventId = req.params.id;

  // Remove participants no longer in list
  parts = parts.filter(p => {
    if (p.eventId !== eventId) return true;
    const uname = friendUsers.find(u => u.id === p.userId)?.username;
    return participants.includes(uname);
  });

  // Add new participants
  participants.forEach(uname => {
    const target = friendUsers.find(u => u.username === uname && u.id !== req.user.userId);
    if (target && !parts.find(p => p.eventId === eventId && p.userId === target.id)) {
      parts.push({ id: uuidv4(), eventId, userId: target.id, invitedBy: req.user.userId, status: 'pending', createdAt: new Date().toISOString() });
    }
  });
  writeParticipants(parts);

  res.json(events[idx]);
});

// Delete event
app.delete('/api/events/:id', authMiddleware, (req, res) => {
  let events = readEvents();
  const originalLen = events.length;
  events = events.filter(e => !(e.id === req.params.id && e.userId === req.user.userId));
  if (events.length === originalLen) return res.status(404).json({ error: 'Not found' });
  writeEvents(events);

  // Cascade delete participants
  let parts = readParticipants();
  parts = parts.filter(p => p.eventId !== req.params.id);
  writeParticipants(parts);

  res.json({ success: true });
});

// Get my pending/tentative event invitations
app.get('/api/participants/pending', authMiddleware, (req, res) => {
  const parts = readParticipants().filter(p => p.userId === req.user.userId && (p.status === 'pending' || p.status === 'tentative'));
  const events = readEvents();
  const users = readUsers();
  const result = parts.map(p => {
    const ev = events.find(e => e.id === p.eventId);
    const owner = users.find(u => u.id === p.invitedBy);
    return {
      id: p.id,
      eventId: p.eventId,
      status: p.status,
      event: ev || null,
      invitedBy: owner?.username || 'unknown'
    };
  }).filter(x => x.event);
  res.json(result);
});

// Respond to invitation
app.post('/api/participants/respond', authMiddleware, (req, res) => {
  const { eventId, status } = req.body;
  if (!['accepted', 'declined', 'tentative'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  let parts = readParticipants();
  const idx = parts.findIndex(p => p.eventId === eventId && p.userId === req.user.userId);
  if (idx === -1) return res.status(404).json({ error: 'Invitation not found' });
  parts[idx].status = status;
  writeParticipants(parts);
  res.json({ success: true, status });
});

// Search users
app.get('/api/users/search', authMiddleware, (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  const users = readUsers();
  const results = users
    .filter(u => u.id !== req.user.userId && u.username.toLowerCase().includes(q))
    .map(u => ({ id: u.id, username: u.username }));
  res.json(results);
});

// Get user profile by username (public info)
app.get('/api/users/:username', authMiddleware, (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.username === req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username });
});

// Request subscription
app.post('/api/subscriptions/request', authMiddleware, (req, res) => {
  const { targetUsername } = req.body;
  const users = readUsers();
  const target = users.find(u => u.username === targetUsername);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.user.userId) return res.status(400).json({ error: 'Cannot subscribe to yourself' });
  const subs = readSubs();
  const existing = subs.find(s => s.subscriberId === req.user.userId && s.targetId === target.id);
  if (existing) return res.status(409).json({ error: 'Already requested or subscribed' });
  subs.push({ id: uuidv4(), subscriberId: req.user.userId, targetId: target.id, status: 'pending', createdAt: new Date().toISOString() });
  writeSubs(subs);
  res.json({ success: true });
});

// Respond to subscription request
app.post('/api/subscriptions/respond', authMiddleware, (req, res) => {
  const { requestId, action } = req.body; // action: 'accept' | 'reject'
  const subs = readSubs();
  const idx = subs.findIndex(s => s.id === requestId && s.targetId === req.user.userId && s.status === 'pending');
  if (idx === -1) return res.status(404).json({ error: 'Request not found' });
  if (action === 'accept') subs[idx].status = 'accepted';
  else subs.splice(idx, 1);
  writeSubs(subs);
  res.json({ success: true });
});

// Get pending requests (incoming)
app.get('/api/subscriptions/pending', authMiddleware, (req, res) => {
  const subs = readSubs();
  const users = readUsers();
  const pending = subs
    .filter(s => s.targetId === req.user.userId && s.status === 'pending')
    .map(s => ({ id: s.id, subscriber: users.find(u => u.id === s.subscriberId)?.username || 'unknown' }));
  res.json(pending);
});

// Get my subscriptions (outgoing accepted + incoming accepted)
app.get('/api/subscriptions/friends', authMiddleware, (req, res) => {
  const subs = readSubs();
  const users = readUsers();
  // People I subscribed to and they accepted
  const subscribedTo = subs
    .filter(s => s.subscriberId === req.user.userId && s.status === 'accepted')
    .map(s => ({ id: s.id, username: users.find(u => u.id === s.targetId)?.username || 'unknown', direction: 'outgoing' }));
  // People who subscribed to me and I accepted
  const subscribers = subs
    .filter(s => s.targetId === req.user.userId && s.status === 'accepted')
    .map(s => ({ id: s.id, username: users.find(u => u.id === s.subscriberId)?.username || 'unknown', direction: 'incoming' }));
  res.json([...subscribedTo, ...subscribers]);
});

// Unsubscribe or remove friend
app.delete('/api/subscriptions/:id', authMiddleware, (req, res) => {
  let subs = readSubs();
  const originalLen = subs.length;
  subs = subs.filter(s => !(s.id === req.params.id && (s.subscriberId === req.user.userId || s.targetId === req.user.userId)));
  if (subs.length === originalLen) return res.status(404).json({ error: 'Not found' });
  writeSubs(subs);
  res.json({ success: true });
});

// Get friend's events (only if subscribed and accepted)
app.get('/api/events/friend/:username', authMiddleware, (req, res) => {
  const users = readUsers();
  const friend = users.find(u => u.username === req.params.username);
  if (!friend) return res.status(404).json({ error: 'User not found' });
  const subs = readSubs();
  const isFriend = subs.some(s =>
    ((s.subscriberId === req.user.userId && s.targetId === friend.id) ||
     (s.subscriberId === friend.id && s.targetId === req.user.userId)) &&
    s.status === 'accepted'
  );
  if (!isFriend) return res.status(403).json({ error: 'Not friends' });
  const { start, end } = req.query;
  let events = readEvents().filter(e => e.userId === friend.id);
  if (start && end) events = events.filter(e => e.date >= start && e.date <= end);
  res.json(events);
});

app.listen(PORT, () => {
  console.log(`Schedule server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
