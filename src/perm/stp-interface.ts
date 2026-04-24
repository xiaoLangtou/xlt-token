export interface StpInterface {

  /**
   * 根据登录ID获取权限列表
   * @param loginId 登录ID
   * @example ['user:add', 'user:delete']
   * @returns 权限列表
   */
  getPermissionList(loginId: string): Promise<string[]> | string[];

  /**
   * 根据登录ID获取角色列表
   * @param loginId 登录ID
   * @example ['admin', 'user']
   * @returns 角色列表
   */
  getRoleList(loginId: string): Promise<string[]> | string[];

}


export const XLT_STP_INTERFACE = 'XLT_STP_INTERFACE';
