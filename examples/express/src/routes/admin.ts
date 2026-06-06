import { Router } from 'express';
import { getRecentHookEvents } from '../config/audit-hooks';

export function createAdminRouter() {
  const router = Router();

  router.get('/hooks', (_req, res) => {
    res.json({ events: getRecentHookEvents() });
  });

  router.get('/dashboard', (_req, res) => {
    res.json({
      message: '管理员面板',
      tips: ['GET /session/online-count', 'GET /admin/hooks', 'POST /session/kickout'],
    });
  });

  return router;
}
