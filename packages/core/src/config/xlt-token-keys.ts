export class XltTokenKeys {

  constructor(readonly tokenName: string) {}

  /**
   * 生成token key
   * @param token
   * @
   */
  tokenKey(token: string): string {
    return `${this.tokenName}:login:token:${token}`;
  }

  /**
   * 生成session key
   * @param loginId
   * @
   */
  sessionKey(loginId: string, device = 'default'): string {
    return `${this.tokenName}:login:session:${loginId}:${device}`;
  }

  sessionListKey(loginId: string): string {
    return `${this.tokenName}:login:session-list:${loginId}`;
  }

  jwtBlacklistKey(jti: string): string {
    return `${this.tokenName}:jwt-blacklist:${jti}`;
  }

  /**
   * 生成sessionData key
   * @param loginId
   * @
   */
  sessionDataKey(loginId: string): string {
    return `${this.tokenName}:login:session-data:${loginId}`;
  }

  offlineRecordKey(token: string): string {
    return `${this.tokenName}:login:offline:${token}`;
  }

  /**
   * 生成lastActive
   * @param token
   * @
   */
  lastActiveKey(token: string): string {
    return `${this.tokenName}:login:lastActive:${token}`;
  }

  /**
   * 生成二级认证key
   * @param token  用户token
   * @param business 业务标识
   * @returns 二级认证key
   */
  safeKey(token: string, business: string): string {
    return `${this.tokenName}:safe:${token}:${business}`;
  }

  /**
   * 生成临时token key
   * @param tempToken  临时token字符串
   * @returns 临时token key
   */
  tempTokenKey(tempToken: string): string {
    return `${this.tokenName}:temp-token:${tempToken}`;
  }

  permCacheKey(loginId: string): string {
    return `${this.tokenName}:perm-cache:perm:${loginId}`;
  }

  roleCacheKey(loginId: string): string {
    return `${this.tokenName}:perm-cache:role:${loginId}`;
  }

}
