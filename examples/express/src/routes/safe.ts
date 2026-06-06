import { Router } from 'express';
import { StpUtil } from '@xlt-token/express';
import { asyncHandler } from '../middleware/async-handler';

export function createSafeRouter() {
  const router = Router();

  router.post('/open', asyncHandler(async (req, res) => {
    const { business = 'pay', timeout = 300 } = req.body as { business?: string; timeout?: number };
    await StpUtil.openSafe(req.stpToken!, business, timeout);
    res.json({ ok: true, business, timeout });
  }));

  router.post('/close', asyncHandler(async (req, res) => {
    const { business = 'pay' } = req.body as { business?: string };
    await StpUtil.closeSafe(req.stpToken!, business);
    res.json({ ok: true, business });
  }));

  router.post('/transfer', (req, res) => {
    const { amount, to } = req.body as { amount: number; to: string };
    res.json({ ok: true, loginId: req.stpLoginId, amount, to });
  });

  router.post('/delete-account', (req, res) => {
    res.json({ ok: true, loginId: req.stpLoginId, deleted: true });
  });

  return router;
}
