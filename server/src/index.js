import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { pool } from './db.js';
import { usersRouter, ensureUploadDirs } from './routes/users.js';
import { runMigrate } from './migrate.js';
import {
  seedSuperuser,
  seedGourmetDemoUser,
  seedFleetDemoUser,
  seedUltraorganicsUser,
  seedUltraorganicsTeamUsers,
  seedThermoKingUser,
  seedGreenyardUser,
} from './seed.js';
import { seedCatalog } from './seedCatalog.js';
import { seedAlarmCodes } from './seedAlarmCodes.js';
import { authRouter } from './routes/auth.js';
import { authMiddleware } from './authMiddleware.js';
import { productsRouter } from './routes/products.js';
import { recipesRouter } from './routes/recipes.js';
import { maduradorRouter } from './routes/madurador.js';
import { maduradorDemoProxyRouter } from './routes/maduradorDemoProxy.js';
import { tunelRouter } from './routes/tunel.js';
import { deviceNamesRouter } from './routes/deviceNames.js';
import { deviceProcessFollowRouter } from './routes/deviceProcessFollow.js';
import { ripeningProcessesRouter, ensureRipeningUploadDirs } from './routes/ripeningProcesses.js';
import { deviceControlRouter } from './routes/deviceControl.js';
import { auditRouter } from './routes/audit.js';
import { companiesRouter } from './routes/companies.js';
import { tunnelCommandsRouter } from './routes/tunnelCommands.js';
import { alarmCodesRouter } from './routes/alarmCodes.js';
import { controlLogicRouter } from './routes/controlLogic.js';
import { emailNotificationsRouter } from './routes/emailNotifications.js';
import {
  finalizeDueRipeningProcesses,
  finalizeDueDeviceControlSessions,
} from './autoFinalizeDueProcesses.js';
import { processTunnelCommandJobs, POLL_INTERVAL_MS } from './tunnelCommandCompliance.js';
import {
  GOURMET_PROCESS_POLL_MS,
  processGourmetActiveControlSessions,
} from './gourmetProcessControl.js';
import {
  kickTrackingControlForProcess,
  processGourmetActiveTrackingSessions,
} from './ripeningTrackingControl.js';
import { processOnlineDeviceEthyleneIdlePolls } from './deviceEthyleneIdlePoll.js';

const PORT = Number(process.env.PORT) || 4000;
const AUTO_FINALIZE_MS = Math.max(15000, Number(process.env.AUTO_FINALIZE_INTERVAL_MS) || 60000);

async function main() {
  await runMigrate();
  ensureUploadDirs();
  ensureRipeningUploadDirs();
  await seedSuperuser();
  await seedGourmetDemoUser();
  await seedFleetDemoUser();
  await seedUltraorganicsUser();
  await seedUltraorganicsTeamUsers();
  await seedThermoKingUser();
  await seedGreenyardUser();
  await seedCatalog();
  await seedAlarmCodes();

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
  app.use('/api/v1/madurador-demo', authMiddleware, maduradorDemoProxyRouter);
  app.use('/api/v1/tunel', authMiddleware, tunelRouter);
  app.use('/api/v1/device-names', authMiddleware, deviceNamesRouter);
  app.use('/api/v1/device-process-follow', authMiddleware, deviceProcessFollowRouter);
  app.use('/api/v1/ripening-processes', authMiddleware, ripeningProcessesRouter);
  app.use('/api/v1/device-control', authMiddleware, deviceControlRouter);
  app.use('/api/v1/audit', authMiddleware, auditRouter);
  app.use('/api/v1/companies', authMiddleware, companiesRouter);
  app.use('/api/v1/alarm-codes', authMiddleware, alarmCodesRouter);
  app.use('/api/v1/control-logic', authMiddleware, controlLogicRouter);
  app.use('/api/v1/tunnel-commands', authMiddleware, tunnelCommandsRouter);
  app.use('/api/v1/email-notifications', authMiddleware, emailNotificationsRouter);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'server_error', message: err.message });
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[api] listening on :${PORT}`);
  });

  setInterval(() => {
    Promise.all([finalizeDueRipeningProcesses(), finalizeDueDeviceControlSessions()]).catch((e) =>
      console.error('[auto-finalize]', e.message)
    );
  }, AUTO_FINALIZE_MS).unref?.();

  setInterval(() => {
    processTunnelCommandJobs().catch((e) => console.error('[tunnel-compliance]', e.message));
  }, POLL_INTERVAL_MS).unref?.();

  setInterval(() => {
    Promise.all([
      processGourmetActiveControlSessions(),
      processGourmetActiveTrackingSessions(),
      processOnlineDeviceEthyleneIdlePolls(),
    ]).catch((e) => console.error('[gourmet-process]', e.message));
  }, GOURMET_PROCESS_POLL_MS).unref?.();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
