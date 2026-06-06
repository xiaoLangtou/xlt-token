import { Router } from 'express';
import { StpUtil } from '@xlt-token/express';
import { asyncHandler } from '../middleware/async-handler';

export function createDeviceRouter() {
  const router = Router();

  router.post('/login', asyncHandler(async (req, res) => {
    const { loginId, device } = req.body as { loginId: string; device: string };
    const token = await StpUtil.login(loginId, { device });
    res.json({ token, loginId, device });
  }));

  router.get('/list', asyncHandler(async (req, res) => {
    const loginId = req.stpLoginId!;
    const devices = await StpUtil.getDeviceList(loginId);
    res.json({ loginId, devices });
  }));

  router.post('/kickout-by-device', asyncHandler(async (req, res) => {
    const { loginId, device } = req.body as { loginId: string; device: string };
    const ok = await StpUtil.kickoutByDevice(loginId, device);
    res.json({ ok });
  }));

  router.post('/kickout-by-token', asyncHandler(async (req, res) => {
    const { token } = req.body as { token: string };
    const ok = await StpUtil.kickoutByToken(token);
    res.json({ ok });
  }));

  router.post('/force-logout', asyncHandler(async (req, res) => {
    const ok = await StpUtil.forceLogout(req.stpLoginId!);
    res.json({ ok });
  }));

  router.get('/me', (req, res) => {
    res.json({ loginId: req.stpLoginId, token: req.stpToken });
  });

  return router;
}
