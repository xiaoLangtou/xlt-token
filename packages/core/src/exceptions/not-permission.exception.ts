import { XltMode } from "../const/index.js";
import { XltError } from "./xlt-error.js";

export class NotPermissionException extends XltError {
  readonly status = 403;
  readonly permission: string | string[];
  readonly mode: XltMode;

  constructor(permission: string | string[], mode: XltMode) {
    super(
      `缺少权限: ${Array.isArray(permission) ? permission.join(", ") : permission}`,
      "PERMISSION_DENIED",
      403,
      { permission, mode },
    );
    this.permission = permission;
    this.mode = mode;
  }
}
