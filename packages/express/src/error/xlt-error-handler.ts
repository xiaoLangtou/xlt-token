import type { ErrorRequestHandler } from "express";
import { mapXltError } from "./map-xlt-error.js";

/**
 * 四参数 Express 错误中间件，挂在路由链末尾，将 core 鉴权异常转为 401/403 JSON。
 * 非 xlt-token 异常透传给下一个错误处理器。
 *
 * @example
 * app.use(xltErrorHandler());
 */
export function xltErrorHandler(): ErrorRequestHandler {
  return (err, _req, res, next) => {
    const mapped = mapXltError(err);
    if (!mapped) {
      next(err);
      return;
    }
    res.status(mapped.status).json(mapped.body);
  };
}
