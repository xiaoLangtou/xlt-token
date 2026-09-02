import {
  NotLoginException,
  NotPermissionException,
  NotRoleException,
  NotSafeException,
} from "@xlt-token/core";

export interface MappedXltError {
  status: number;
  body: Record<string, unknown>;
}

/**
 * 将 core 鉴权异常映射为 HTTP 状态码 + JSON body。
 *
 * 响应体结构与 Express / NestJS 适配器保持一致（`statusCode` / `code` / core 异常 details / `message`）。
 * 非 xlt-token 异常返回 `null`，交由调用方继续向后传递。
 */
export function mapXltError(err: unknown): MappedXltError | null {
  if (err instanceof NotLoginException) {
    return {
      status: 401,
      body: {
        statusCode: 401,
        code: err.code,
        ...err.details,
        message: err.message,
      },
    };
  }

  if (err instanceof NotPermissionException) {
    return {
      status: 403,
      body: {
        statusCode: 403,
        code: err.code,
        ...err.details,
        message: err.message,
      },
    };
  }

  if (err instanceof NotRoleException) {
    return {
      status: 403,
      body: {
        statusCode: 403,
        code: err.code,
        ...err.details,
        message: err.message,
      },
    };
  }

  if (err instanceof NotSafeException) {
    return {
      status: 403,
      body: {
        statusCode: 403,
        code: err.code,
        ...err.details,
        message: err.message,
      },
    };
  }

  return null;
}
