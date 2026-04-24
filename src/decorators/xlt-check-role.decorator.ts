import { XLT_ROLE_KEY, XltMode } from '../const';
import { SetMetadata } from '@nestjs/common';


/**
 * 角色检查装饰器
 * @param {string | string[]} roles 角色列表
 * @param {Object} [options] 模式选项
 * @param {XltMode} [options.mode] 模式选项
 * @constructor
 */
export const XltCheckRole = (roles: string | string[], options?: { mode: XltMode; }) => {
  const _roles = Array.isArray(roles) ? roles : [roles];
  const mode = options?.mode ?? XltMode.AND;
  return SetMetadata(XLT_ROLE_KEY, { roles: _roles, mode });

};
