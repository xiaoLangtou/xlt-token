import { ForbiddenException } from '@nestjs/common';
import { XltMode } from '../const';

export class NotPermissionException extends ForbiddenException {
  public readonly permission: string | string[];
  public readonly mode: XltMode;

  constructor(permission: string | string[], mode: XltMode) {
    super({
      statusCode: 403,
      type: 'NOT_PERMISSION',
      message: `缺少权限: ${Array.isArray(permission) ? permission.join(', ') : permission}`,
    });
    this.permission = permission;
    this.mode = mode;
  }
}
