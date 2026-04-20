// 静态门面
import { Request } from 'express';
import { ModuleRef } from '@nestjs/core';


let _stpLogic: any = null;
let _moduleRef: ModuleRef | null = null;

/**
 * 设置 StpLogic 实例（由模块内部调用）
 */
export function setStpLogic(stpLogic: any) {
  _stpLogic = stpLogic;
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
 * 静态门面类
 */
export class StpUtil {
  /**
   * 登录
   */
  static async login(
    loginId: string | number,
    options: { timeout?: number; device?: string; token?: string } = {},
  ): Promise<string> {
    return getStpLogic().login(loginId, options);
  }

  /**
   * 登出（通过 token）
   */
  static async logout(token: string): Promise<boolean | null> {
    return getStpLogic().logout(token);
  }

  /**
   * 登出（通过 loginId）
   */
  static async logoutByLoginId(loginId: string): Promise<boolean | null> {
    return getStpLogic().logoutByLoginId(loginId);
  }

  /**
   * 踢人下线
   */
  static async kickout(loginId: string): Promise<boolean | null> {
    return getStpLogic().kickout(loginId);
  }

  /**
   * 续签 token
   */
  static async renewTimeout(token: string, timeout: number): Promise<boolean | null> {
    return getStpLogic().renewTimeout(token, timeout);
  }

  /**
   * 判断是否登录
   */
  static async isLogin(req: Request): Promise<boolean> {
    return getStpLogic().isLogin(req);
  }

  /**
   * 校验登录（未登录抛出异常）
   */
  static async checkLogin(req: Request): Promise<{ ok: boolean; loginId?: string; token?: string }> {
    return getStpLogic().checkLogin(req);
  }

  /**
   * 获取当前登录用户 ID
   */
  static async getLoginId(req: Request): Promise<string | null> {
    const result = await getStpLogic().checkLogin(req);
    return result.loginId || null;
  }

  /**
   * 获取当前 token 值
   */
  static async getTokenValue(req: Request): Promise<string | null> {
    return getStpLogic().getTokenValue(req);
  }
}
