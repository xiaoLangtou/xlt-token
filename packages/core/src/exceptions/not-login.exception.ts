import { NotLoginType } from "../const/index.js";
import { XltError } from "./xlt-error.js";

export class NotLoginException extends XltError {
  readonly status = 401;
  readonly type: NotLoginType;
  readonly token?: string;

  constructor(type: NotLoginType, token?: string) {
    super(NotLoginException.describeType(type), "NOT_LOGIN", 401);
    this.type = type;
    this.token = token;
  }

  private static describeType(type: NotLoginType): string {
    const map: Record<NotLoginType, string> = {
      [NotLoginType.NOT_TOKEN]: "未提供 Token",
      [NotLoginType.INVALID_TOKEN]: "Token 无效",
      [NotLoginType.TOKEN_TIMEOUT]: "Token 已过期",
      [NotLoginType.TOKEN_FREEZE]: "Token 已被冻结",
      [NotLoginType.BE_REPLACED]: "已被顶下线",
      [NotLoginType.KICK_OUT]: "已被踢下线",
    };
    return map[type] ?? "未登录";
  }
}
