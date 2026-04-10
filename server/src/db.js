import pg from 'pg';

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ||
  'postgresql://riper:riper@localhost:15432/riper';

export const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
});
