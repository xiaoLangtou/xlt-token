export interface XltHooks {

  /**
   * 登录成功后触发
   * @param loginId 登录ID
   * @param token 令牌
   * @param device 设备
   */
  onLogin?: (loginId: string, token: string, device: string) => void | Promise<void>;

  /**
   * 登出后触发
   * @param loginId 登录ID
   * @param token 令牌
   * @param reason 登出原因
   */
  onLogout?: (loginId: string, token: string, reason: string) => void | Promise<void>;

  /**
   * 踢出后触发
   * @param loginId 登录ID
   * @param token 令牌
   */
  onKickout?: (loginId: string, token: string) => void | Promise<void>;

  /**
   * 替换后触发
   * @param loginId 登录ID
   * @param oldToken 旧令牌
   * @param newToken 新令牌
   */
  onReplaced?: (loginId: string, oldToken: string, newToken: string) => void | Promise<void>;
}


/**
 * 钩子注入 token
 */
export const XLT_TOKEN_HOOKS = 'XLT_TOKEN_HOOKS';
