import { Router } from "express";
import { StpUtil } from "@xlt-token/express";
import { asyncHandler } from "../middleware/async-handler";

export function createSessionRouter() {
  const router = Router();

  router.post(
    "/login-replace",
    asyncHandler(async (req, res) => {
      const { loginId } = req.body as { loginId: string };
      const token = await StpUtil.login(loginId);
      res.json({ token, loginId });
    }),
  );

  router.post(
    "/login-share",
    asyncHandler(async (req, res) => {
      const { loginId, device = "default" } = req.body as { loginId: string; device?: string };
      const token = await StpUtil.login(loginId, { device });
      res.json({ token, hint: "需 config.isShare=true 才返回相同 token" });
    }),
  );

  router.post(
    "/kickout",
    asyncHandler(async (req, res) => {
      const { loginId, device } = req.body as { loginId: string; device?: string };
      const ok = await StpUtil.kickout(loginId, device);
      res.json({ ok });
    }),
  );

  router.post(
    "/logout-by-login-id",
    asyncHandler(async (req, res) => {
      const { loginId } = req.body as { loginId: string };
      const ok = await StpUtil.logoutByLoginId(loginId);
      res.json({ ok });
    }),
  );

  router.get(
    "/online-count",
    asyncHandler(async (_req, res) => {
      const count = await StpUtil.getOnlineCount();
      res.json({ count });
    }),
  );

  router.get(
    "/online-ids",
    asyncHandler(async (_req, res) => {
      const loginIds = await StpUtil.getOnlineLoginIds({ page: 0, pageSize: 50 });
      res.json({ loginIds });
    }),
  );

  router.get("/check", (req, res) => {
    res.json({ loginId: req.stpLoginId, token: req.stpToken, isLogin: true });
  });

  return router;
}
