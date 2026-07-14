import express, { type Express } from "express";
import {
  createXltToken,
  MemoryStore,
  XltMode,
  type StpInterface,
  type XltTokenConfig,
  type XltTokenContext,
} from "@xlt-token/core";
import {
  checkPermission,
  checkRole,
  checkSafe,
  ignoreAuth,
  requireLogin,
  xltErrorHandler,
  xltMiddleware,
} from "../../src/index.js";

/**
 * 权限/角色数据源：
 * - 1001：拥有 user:read、order:*（含 order:read）与 admin 角色
 * - 其他：无任何权限/角色
 */
const stpInterface: StpInterface = {
  getPermissionList: async (loginId) => (loginId === "1001" ? ["user:read", "order:*"] : []),
  getRoleList: async (loginId) => (loginId === "1001" ? ["admin"] : []),
};

export interface TestApp {
  app: Express;
  xlt: XltTokenContext;
}

/**
 * 构建一个与文档「Router 级 xltMiddleware + policies」最佳实践一致的 Express 应用。
 * 路由（挂载在 /api 前缀下）：
 * - POST /api/auth/login  公开，签发 token
 * - GET  /api/public      公开
 * - GET  /api/publicity   普通受保护路由，用于防止 /api/public 前缀误匹配
 * - GET  /api/me          需登录，回显 stpLoginId / stpToken
 * - GET  /api/admin       需权限 admin:write
 * - GET  /api/order       需权限 order:read
 * - GET  /api/role-admin  需角色 admin
 * - POST /api/pay         需二级认证 safe(pay)
 */
export function createTestApp(config: Partial<XltTokenConfig> = {}): TestApp {
  const xlt = createXltToken({
    config: { tokenPrefix: "", ...config },
    store: new MemoryStore(),
    stpInterface,
  });

  const app = express();
  app.use(express.json());

  const api = express.Router();
  api.use(
    xltMiddleware(xlt, {
      ignore: ["/api/auth/login", "/api/public"],
      policies: [
        { match: "/api/admin", permissions: { list: ["admin:write"], mode: XltMode.AND } },
        { match: "/api/order", permissions: { list: ["order:read"], mode: XltMode.AND } },
        { match: "/api/role-admin", roles: { list: ["admin"], mode: XltMode.AND } },
        { match: "/api/pay", safeBusiness: "pay" },
      ],
    }),
  );

  api.post("/auth/login", async (req, res) => {
    const { userId = "1001", device } = req.body ?? {};
    const token = await xlt.stpLogic.login(userId, device ? { device } : {});
    res.json({ token });
  });

  api.get("/public", (_req, res) => {
    res.json({ ok: true });
  });

  api.get("/publicity", (_req, res) => {
    res.json({ ok: true });
  });

  api.get("/me", (req, res) => {
    res.json({ id: req.stpLoginId, token: req.stpToken });
  });

  api.get("/admin", (_req, res) => {
    res.json({ ok: true });
  });

  api.get("/order", (_req, res) => {
    res.json({ ok: true });
  });

  api.get("/role-admin", (_req, res) => {
    res.json({ ok: true });
  });

  api.post("/pay", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", api);

  app.get("/helper/public", ignoreAuth(), xltMiddleware(xlt), (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/helper/required", requireLogin(), xltMiddleware(xlt), (req, res) => {
    res.json({ id: req.stpLoginId, token: req.stpToken });
  });

  app.get("/helper/order", checkPermission("order:read"), xltMiddleware(xlt), (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/helper/role-admin", checkRole("admin"), xltMiddleware(xlt), (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/helper/pay", checkSafe("pay"), xltMiddleware(xlt), (_req, res) => {
    res.json({ ok: true });
  });

  app.use(xltErrorHandler());

  return { app, xlt };
}
