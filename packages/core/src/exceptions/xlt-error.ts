export type XltErrorCode =
  | "TOKEN_MISSING"
  | "TOKEN_INVALID"
  | "TOKEN_TIMEOUT"
  | "TOKEN_FREEZE"
  | "TOKEN_REPLACED"
  | "TOKEN_KICKED_OUT"
  | "PERMISSION_DENIED"
  | "ROLE_DENIED"
  | "SAFE_REQUIRED"
  | "CONFIG_INVALID";

export type XltErrorDetails = Record<string, string | string[] | number | boolean | null>;

export class XltError extends Error {
  readonly code: XltErrorCode;
  readonly status: number;
  readonly details: XltErrorDetails;

  constructor(message: string, code: XltErrorCode, status: number, details: XltErrorDetails = {}) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
