const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { pool, initDatabase } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'schedule-tool-secret-key-2025';

// CORS - allow all origins
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

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

  try {
    const passwordHash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      'INSERT INTO users (id, username, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [uuidv4(), username, passwordHash]
    );
    res.json({ success: true, message: 'Registered' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'User already exists' });
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, username: user.username });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get events in range
app.get('/api/events', authMiddleware, async (req, res) => {
  const { start, end } = req.query;
  try {
    // Events I own with participants
    let eventsQuery = `
      SELECT e.*, true as is_owner,
        COALESCE(json_agg(
          json_build_object(
            'userId', p.user_id,
            'username', u2.username,
            'status', p.status
          ) ORDER BY u2.username
        ) FILTER (WHERE p.user_id IS NOT NULL), '[]') as participants
      FROM events e
      LEFT JOIN participants p ON e.id = p.event_id
      LEFT JOIN users u2 ON p.user_id = u2.id
      WHERE e.user_id = $1
      GROUP BY e.id
    `;

    if (start && end) {
      eventsQuery += ` AND e.date BETWEEN $2 AND $3`;
    }

    const ownedResult = await pool.query(eventsQuery, start && end ? [req.user.userId, start, end] : [req.user.userId]);
    let events = ownedResult.rows.map(e => ({ ...e, isOwner: true, participants: e.participants || [] }));

    // Events I'm invited to (not declined)
    const invitedQuery = `
      SELECT e.*, p2.status as invitation_status, false as is_owner,
        COALESCE(json_agg(
          json_build_object(
            'userId', p3.user_id,
            'username', u3.username,
            'status', p3.status
          ) ORDER BY u3.username
        ) FILTER (WHERE p3.user_id IS NOT NULL), '[]') as participants
      FROM participants p2
      JOIN events e ON p2.event_id = e.id
      LEFT JOIN participants p3 ON e.id = p3.event_id
      LEFT JOIN users u3 ON p3.user_id = u3.id
      WHERE p2.user_id = $1 AND p2.status != 'declined'
    `;

    const invitedResult = await pool.query(
      start && end ? invitedQuery + ` AND e.date BETWEEN $2 AND $3 GROUP BY e.id, p2.status` : invitedQuery + ` GROUP BY e.id, p2.status`,
      start && end ? [req.user.userId, start, end] : [req.user.userId]
    );

    const invitedEvents = invitedResult.rows.map(e => ({
      ...e,
      isOwner: false,
      invitationStatus: e.invitation_status,
      participants: e.participants || []
    }));

    // Deduplicate
    const seen = new Set(events.map(e => e.id));
    invitedEvents.forEach(e => {
      if (!seen.has(e.id)) {
        seen.add(e.id);
        events.push(e);
      }
    });

    res.json(events);
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create event
app.post('/api/events', authMiddleware, async (req, res) => {
  const { title, date, time, endTime, description, participants = [] } = req.body;
  if (!title || !date || !time) return res.status(400).json({ error: 'title, date, time required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create event
    const eventId = uuidv4();
    await client.query(
      'INSERT INTO events (id, user_id, title, date, time, end_time, description) VALUES ($1, $2, $3, $4, $5, $6, $7)',
      [eventId, req.user.userId, title, date, time, endTime || null, description || '']
    );

    // Get friend IDs
    const friendsResult = await client.query(
      `SELECT DISTINCT u.id FROM users u
       JOIN subscriptions s ON (u.id = s.target_id AND s.subscriber_id = $1) OR (u.id = s.subscriber_id AND s.target_id = $1)
       WHERE s.status = 'accepted' AND u.username = ANY($2)`,
      [req.user.userId, participants]
    );

    // Create participant invitations
    for (const friend of friendsResult.rows) {
      await client.query(
        'INSERT INTO participants (id, event_id, user_id, invited_by, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
        [uuidv4(), eventId, friend.id, req.user.userId, 'pending']
      );
    }

    await client.query('COMMIT');

    const eventResult = await pool.query('SELECT * FROM events WHERE id = $1', [eventId]);
    res.json(eventResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Update event
app.put('/api/events/:id', authMiddleware, async (req, res) => {
  const { title, date, time, endTime, description, participants = [] } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Update event
    const updateResult = await client.query(
      'UPDATE events SET title = $1, date = $2, time = $3, end_time = $4, description = $5 WHERE id = $6 AND user_id = $7 RETURNING *',
      [title, date, time, endTime || null, description || '', req.params.id, req.user.userId]
    );

    if (updateResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Not found' });
    }

    // Get friend IDs
    const friendsResult = await client.query(
      `SELECT DISTINCT u.id FROM users u
       JOIN subscriptions s ON (u.id = s.target_id AND s.subscriber_id = $1) OR (u.id = s.subscriber_id AND s.target_id = $1)
       WHERE s.status = 'accepted' AND u.username = ANY($2)`,
      [req.user.userId, participants]
    );
    const friendIds = friendsResult.rows.map(f => f.id);

    // Remove participants not in list
    await client.query(
      'DELETE FROM participants WHERE event_id = $1 AND user_id NOT IN (SELECT unnest($2::uuid[]))',
      [req.params.id, friendIds.length > 0 ? friendIds : [null]]
    );

    // Add new participants
    for (const friendId of friendIds) {
      await client.query(
        'INSERT INTO participants (id, event_id, user_id, invited_by, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING',
        [uuidv4(), req.params.id, friendId, req.user.userId, 'pending']
      );
    }

    await client.query('COMMIT');
    res.json(updateResult.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Update event error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Delete event
app.delete('/api/events/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM events WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get pending invitations
app.get('/api/participants/pending', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.id, p.event_id, p.status,
        json_build_object('id', e.id, 'title', e.title, 'date', e.date, 'time', e.time, 'end_time', e.end_time, 'description', e.description) as event,
        u.username as invited_by
       FROM participants p
       JOIN events e ON p.event_id = e.id
       JOIN users u ON p.invited_by = u.id
       WHERE p.user_id = $1 AND p.status IN ('pending', 'tentative')`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get pending invitations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Respond to invitation
app.post('/api/participants/respond', authMiddleware, async (req, res) => {
  const { eventId, status } = req.body;
  if (!['accepted', 'declined', 'tentative'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  try {
    const result = await pool.query(
      'UPDATE participants SET status = $1 WHERE event_id = $2 AND user_id = $3 RETURNING id',
      [status, eventId, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Invitation not found' });
    res.json({ success: true, status });
  } catch (err) {
    console.error('Respond invitation error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Search users
app.get('/api/users/search', authMiddleware, async (req, res) => {
  const q = (req.query.q || '').toLowerCase();
  try {
    const result = await pool.query(
      'SELECT id, username FROM users WHERE id != $1 AND LOWER(username) LIKE $2 LIMIT 10',
      [req.user.userId, `%${q}%`]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Search users error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user by username
app.get('/api/users/:username', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username FROM users WHERE username = $1', [req.params.username]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Request subscription
app.post('/api/subscriptions/request', authMiddleware, async (req, res) => {
  const { targetUsername } = req.body;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const targetResult = await client.query('SELECT id FROM users WHERE username = $1', [targetUsername]);
    if (targetResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'User not found' });
    }
    const targetId = targetResult.rows[0].id;

    if (targetId === req.user.userId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot subscribe to yourself' });
    }

    await client.query(
      'INSERT INTO subscriptions (id, subscriber_id, target_id, status) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
      [uuidv4(), req.user.userId, targetId, 'pending']
    );

    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') return res.status(409).json({ error: 'Already requested or subscribed' });
    console.error('Request subscription error:', err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

// Respond to subscription
app.post('/api/subscriptions/respond', authMiddleware, async (req, res) => {
  const { requestId, action } = req.body;
  try {
    if (action === 'accept') {
      await pool.query(
        "UPDATE subscriptions SET status = 'accepted' WHERE id = $1 AND target_id = $2",
        [requestId, req.user.userId]
      );
    } else {
      await pool.query(
        'DELETE FROM subscriptions WHERE id = $1 AND target_id = $2',
        [requestId, req.user.userId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Respond subscription error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get pending subscriptions
app.get('/api/subscriptions/pending', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, u.username as subscriber
       FROM subscriptions s
       JOIN users u ON s.subscriber_id = u.id
       WHERE s.target_id = $1 AND s.status = 'pending'`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get pending subscriptions error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get friends
app.get('/api/subscriptions/friends', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.id, u.username,
        CASE WHEN s.subscriber_id = $1 THEN 'outgoing' ELSE 'incoming' END as direction
       FROM subscriptions s
       JOIN users u ON (CASE WHEN s.subscriber_id = $1 THEN s.target_id ELSE s.subscriber_id END) = u.id
       WHERE (s.subscriber_id = $1 OR s.target_id = $1) AND s.status = 'accepted'`,
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Get friends error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete subscription
app.delete('/api/subscriptions/:id', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM subscriptions WHERE id = $1 AND (subscriber_id = $2 OR target_id = $2) RETURNING id',
      [req.params.id, req.user.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Delete subscription error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get friend's events
app.get('/api/events/friend/:username', authMiddleware, async (req, res) => {
  try {
    // Check friendship
    const friendResult = await pool.query(
      `SELECT u.id FROM users u
       JOIN subscriptions s ON (u.id = s.target_id AND s.subscriber_id = $1) OR (u.id = s.subscriber_id AND s.target_id = $1)
       WHERE u.username = $2 AND s.status = 'accepted'`,
      [req.user.userId, req.params.username]
    );

    if (friendResult.rows.length === 0) return res.status(403).json({ error: 'Not friends' });
    const friendId = friendResult.rows[0].id;

    const { start, end } = req.query;
    let query = 'SELECT * FROM events WHERE user_id = $1';
    const params = [friendId];

    if (start && end) {
      query += ' AND date BETWEEN $2 AND $3';
      params.push(start, end);
    }

    query += ' ORDER BY date, time';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Get friend events error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Initialize database and start server
async function startServer() {
  try {
    await initDatabase();
    console.log('Database initialized successfully');
  } catch (err) {
    console.error('Database initialization failed:', err);
    console.log('Server will start, but may not function correctly');
  }

  app.listen(PORT, () => {
    console.log(`Schedule server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

startServer();
