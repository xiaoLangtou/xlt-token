// 登录校验装饰器

import { SetMetadata } from "@nestjs/common";
import { XLT_CHECK_LOGIN_KEY } from "@xlt-token/core";

/**
 * 登录校验装饰器
 * @constructor
 */
export const XltCheckLogin = () => SetMetadata(XLT_CHECK_LOGIN_KEY, true);
