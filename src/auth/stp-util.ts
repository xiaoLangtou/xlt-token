// 静态门面
import { Request } from 'express';
import { ModuleRef } from '@nestjs/core';
import { XltMode } from '../const';
import type { XltSession } from '../session/xlt-session';

let _stpLogic: any = null;
let _stpPermLogic: any = null;
let _moduleRef: ModuleRef | null = null;

/**
 * 设置 StpLogic 实例（由模块内部调用）
 */
export function setStpLogic(stpLogic: any) {
  _stpLogic = stpLogic;
}

/**
 * 设置 StpPermLogic 实例（由模块内部调用）
 */
export function setStpPermLogic(stpPermLogic: any) {
  _stpPermLogic = stpPermLogic;
}

/**
 * 设置 ModuleRef（用于动态获取 StpLogic）
 */
export function setModuleRef(moduleRef: ModuleRef) {
  _moduleRef = moduleRef;
}

/**
 * 获取 StpLogic 实例
 */
function getStpLogic() {
  if (!_stpLogic && _moduleRef) {
    _stpLogic = _moduleRef.get('StpLogic');
  }
  if (!_stpLogic) {
    throw new Error('StpLogic not initialized. Please ensure XltTokenModule is imported correctly.');
  }
  return _stpLogic;
}

/**
 * 获取 StpPermLogic 实例
 */
function getStpPermLogic() {
  if (!_stpPermLogic && _moduleRef) {
    try {
      _stpPermLogic = _moduleRef.get('StpPermLogic');
    } catch { /* not registered */ }
  }
  if (!_stpPermLogic) {
    throw new Error('StpPermLogic not initialized. Please ensure XltTokenModule is imported with stpInterface.');
  }
  return _stpPermLogic;
}

/**
 * 静态门面类
 */
export class StpUtil {
  /** 登录 */
  static async login(
    loginId: string | number,
    options: { timeout?: number; device?: string; token?: string } = {},
  ): Promise<string> {
    return getStpLogic().login(loginId, options);
  }

  /** 登出（通过 token） */
  static async logout(token: string): Promise<boolean | null> {
    return getStpLogic().logout(token);
  }

  /** 登出（通过 loginId） */
  static async logoutByLoginId(loginId: string): Promise<boolean | null> {
    return getStpLogic().logoutByLoginId(loginId);
  }

  /** 踢人下线 */
  static async kickout(loginId: string): Promise<boolean | null> {
    return getStpLogic().kickout(loginId);
  }

  /** 续签 token */
  static async renewTimeout(token: string, timeout: number): Promise<boolean | null> {
    return getStpLogic().renewTimeout(token, timeout);
  }

  /** 判断是否登录 */
  static async isLogin(req: Request): Promise<boolean> {
    return getStpLogic().isLogin(req);
  }

  /** 校验登录（未登录抛出异常） */
  static async checkLogin(req: Request): Promise<{ ok: boolean; loginId?: string; token?: string }> {
    return getStpLogic().checkLogin(req);
  }

  /** 获取当前登录用户 ID */
  static async getLoginId(req: Request): Promise<string | null> {
    const result = await getStpLogic().checkLogin(req);
    return result.loginId || null;
  }

  /** 获取当前 token 值 */
  static async getTokenValue(req: Request): Promise<string | null> {
    return getStpLogic().getTokenValue(req);
  }

  /** 判断是否拥有某权限 */
  static async hasPermission(loginId: string, permission: string): Promise<boolean> {
    return getStpPermLogic().hasPermission(loginId, permission);
  }

  /** 校验权限（不通过抛异常） */
  static async checkPermission(loginId: string, permissions: string[], mode: XltMode): Promise<void> {
    return getStpPermLogic().checkPermission(loginId, permissions, mode);
  }

  /** 判断是否拥有某角色 */
  static async hasRole(loginId: string, role: string): Promise<boolean> {
    return getStpPermLogic().hasRole(loginId, role);
  }

  /** 校验角色（不通过抛异常） */
  static async checkRole(loginId: string, roles: string[], mode: XltMode): Promise<void> {
    return getStpPermLogic().checkRole(loginId, roles, mode);
  }

  /** 获取会话对象 */
  static getSession(loginId: string): XltSession {
    return getStpLogic().getSession(loginId);
  }

  /** 查询下线原因 */
  static async getOfflineReason(token: string): Promise<{ reason: string; time: number } | null> {
    return getStpLogic().getOfflineRecords(token);
  }
}
