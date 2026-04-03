const { Pool } = require('pg');

// Supabase PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:SrLUXaWv%23e-3%2FN9@db.tpfzwlhztqdmimnzbwyj.supabase.co:5432/postgres',
  ssl: {
    rejectUnauthorized: false
  }
});

// Test connection
pool.on('connect', () => {
  console.log('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('PostgreSQL connection error:', err);
});

// Initialize database tables
async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        date DATE NOT NULL,
        time TIME NOT NULL,
        end_time TIME,
        description TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        subscriber_id UUID REFERENCES users(id) ON DELETE CASCADE,
        target_id UUID REFERENCES users(id) ON DELETE CASCADE,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(subscriber_id, target_id)
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS participants (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id UUID REFERENCES events(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        invited_by UUID REFERENCES users(id),
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(event_id, user_id)
      );
    `);

    console.log('Database tables initialized');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDatabase };
