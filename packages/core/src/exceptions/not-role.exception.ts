import { XltMode } from "../const/index.js";
import { XltError } from "./xlt-error.js";

export class NotRoleException extends XltError {
  readonly status = 403;
  readonly role: string | string[];
  readonly mode: XltMode;

  constructor(role: string | string[], mode: XltMode) {
    super(`缺少角色: ${Array.isArray(role) ? role.join(", ") : role}`, "ROLE_DENIED", 403, {
      role,
      mode,
    });
    this.role = role;
    this.mode = mode;
  }
}
