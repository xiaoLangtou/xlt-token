import type { ErrorRequestHandler } from "express";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
    readonly body: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const demoErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({
      statusCode: err.statusCode,
      message: err.message,
      ...err.body,
    });
    return;
  }

  console.error("[example:error]", err);
  res.status(500).json({
    statusCode: 500,
    message: err instanceof Error ? err.message : "Internal Server Error",
  });
};
