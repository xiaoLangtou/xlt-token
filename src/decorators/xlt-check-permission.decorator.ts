import { XLT_PERMISSION_KEY, XltMode } from '../const';
import { SetMetadata } from '@nestjs/common';


/**
 * 权限检查装饰器
 * @param {string | string[]} permissions 权限列表
 * @param {Object} [options] 模式选项
 * @param {XltMode} [options.mode] 模式选项
 * @constructor
 */
export const XltCheckPermission = (permissions: string | string[], options?: { mode: XltMode; }) => {
  const perms = Array.isArray(permissions) ? permissions : [permissions];
  const mode = options?.mode ?? XltMode.AND;
  return SetMetadata(XLT_PERMISSION_KEY, { permissions: perms, mode });
};
