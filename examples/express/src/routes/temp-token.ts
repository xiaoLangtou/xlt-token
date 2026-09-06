import { Router } from "express";
import { StpUtil } from "@xlt-token/express";
import { asyncHandler } from "../middleware/async-handler";
import { HttpError } from "../middleware/demo-error-handler";

export function createTempTokenRouter() {
  const router = Router();

  router.post(
    "/create",
    asyncHandler(async (req, res) => {
      const { timeout = 1800 } = req.body as { timeout?: number };
      const userId = req.stpLoginId!;
      const value = `resetPwd:${userId}`;
      const tempToken = await StpUtil.createTempToken(value, timeout);
      res.json({
        tempToken,
        link: `http://localhost:${process.env.PORT ?? 3000}/temp-token/consume?t=${tempToken}`,
      });
    }),
  );

  router.post(
    "/consume",
    asyncHandler(async (req, res) => {
      const { tempToken, newPassword } = req.body as { tempToken: string; newPassword?: string };
      // consumeTempToken 原子完成"读取 + 销毁"：并发重复提交时恰好一次拿到业务值
      const value = await StpUtil.consumeTempToken(tempToken);
      if (!value) throw new HttpError(400, "链接无效、已过期或已被使用");

      const [action, userId] = value.split(":");
      if (action !== "resetPwd" || !userId) {
        throw new HttpError(400, "无效的临时 token 载荷");
      }

      res.json({
        ok: true,
        userId,
        newPassword: newPassword ?? "(demo: password reset simulated)",
      });
    }),
  );

  return router;
}
