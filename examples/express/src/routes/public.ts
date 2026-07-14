import { Router } from "express";
import { StpUtil } from "@xlt-token/express";
import { asyncHandler } from "../middleware/async-handler";

export function createPublicRouter() {
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ ok: true, service: "xlt-token-express-example" });
  });

  router.get(
    "/product/:id",
    asyncHandler(async (req, res) => {
      const loginId = await getOptionalLoginId(req);
      const id = req.params.id;

      res.json({
        id,
        title: `Product ${id}`,
        myRating: loginId ? { loginId, productId: id, score: 5 } : null,
        viewer: loginId ?? "anonymous",
      });
    }),
  );

  return router;
}

async function getOptionalLoginId(req: Parameters<typeof StpUtil.getLoginId>[0]) {
  try {
    return await StpUtil.getLoginId(req);
  } catch {
    return null;
  }
}
