/**
 * 登录状态
 */
export const NotLoginType = {
  NOT_TOKEN: 'NOT_TOKEN', // 请求中没 token
  INVALID_TOKEN: 'INVALID_TOKEN', // token 在服务端找不到
  TOKEN_TIMEOUT: 'TOKEN_TIMEOUT', // 已过期（保留, Store 过期即消失, 实际走 INVALID_TOKEN）
  TOKEN_FREEZE: 'TOKEN_FREEZE', // 临时活跃过期
  BE_REPLACED: 'BE_REPLACED', // 被顶号
  KICK_OUT: 'KICK_OUT', // 被踢下线
} as const;
export type NotLoginType = (typeof NotLoginType)[keyof typeof NotLoginType];

export const XLT_IGNORE_KEY = 'XltIgnore';
export const XLT_CHECK_LOGIN_KEY = 'XltCheckLogin';
