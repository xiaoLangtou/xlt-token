import { ForbiddenException } from "@nestjs/common";
import { XltMode } from "@xlt-token/core";

export class NotRoleException extends ForbiddenException {
  public readonly role: string | string[];
  public readonly mode: XltMode;

  constructor(role: string | string[], mode: XltMode) {
    super({
      statusCode: 403,
      code: "ROLE_DENIED",
      role,
      mode,
      message: `缺少角色: ${Array.isArray(role) ? role.join(", ") : role}`,
    });
    this.role = role;
    this.mode = mode;
  }
}
