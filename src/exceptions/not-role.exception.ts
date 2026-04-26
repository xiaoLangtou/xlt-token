import { ForbiddenException } from '@nestjs/common';
import { XltMode } from '../const';

export class NotRoleException extends ForbiddenException {
  public readonly role: string | string[];
  public readonly mode: XltMode;

  constructor(role: string | string[], mode: XltMode) {
    super({
      statusCode: 403,
      type: 'NOT_ROLE',
      message: `缺少角色: ${Array.isArray(role) ? role.join(', ') : role}`,
    });
    this.role = role;
    this.mode = mode;
  }
}
