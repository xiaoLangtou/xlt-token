import { XltMode } from "../const/index.js";
import { XltError } from "./xlt-error.js";

export class NotPermissionException extends XltError {
  readonly status = 403;
  readonly permission: string | string[];
  readonly mode: XltMode;

  constructor(permission: string | string[], mode: XltMode) {
    super(
      `缺少权限: ${Array.isArray(permission) ? permission.join(", ") : permission}`,
      "NOT_PERMISSION",
      403,
    );
    this.permission = permission;
    this.mode = mode;
  }
}
