import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { pool } from './db.js';
import { usersRouter, ensureUploadDirs } from './routes/users.js';
import { runMigrate } from './migrate.js';
import { seedSuperuser, seedGourmetDemoUser } from './seed.js';
import { seedCatalog } from './seedCatalog.js';
import { authRouter } from './routes/auth.js';
import { authMiddleware } from './authMiddleware.js';
import { productsRouter } from './routes/products.js';
import { recipesRouter } from './routes/recipes.js';
import { maduradorRouter } from './routes/madurador.js';
import { tunelRouter } from './routes/tunel.js';

const PORT = Number(process.env.PORT) || 4000;

async function main() {
  await runMigrate();
  ensureUploadDirs();
  await seedSuperuser();
  await seedGourmetDemoUser();
  await seedCatalog();

  const app = express();
  const corsOrigin = process.env.CORS_ORIGIN;
  app.use(
    cors({
      origin: corsOrigin === '*' || !corsOrigin ? true : corsOrigin.split(',').map((s) => s.trim()),
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));

  app.get('/health', async (_req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ ok: true, db: true });
    } catch (e) {
      res.status(503).json({ ok: false, db: false, error: String(e.message) });
    }
  });

  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/users', authMiddleware, usersRouter);
  app.use('/api/v1/products', authMiddleware, productsRouter);
  app.use('/api/v1/recipes', authMiddleware, recipesRouter);
  app.use('/api/v1/madurador', authMiddleware, maduradorRouter);
  app.use('/api/v1/tunel', authMiddleware, tunelRouter);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'server_error', message: err.message });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[api] listening on :${PORT}`);
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
