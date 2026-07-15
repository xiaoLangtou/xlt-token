import { UnauthorizedException } from "@nestjs/common";
import { NotLoginType, type XltErrorCode } from "@xlt-token/core";

export class NotLoginException extends UnauthorizedException {
  public readonly type: NotLoginType;
  public readonly token: string | undefined;

  constructor(type: NotLoginType, token?: string) {
    super({
      statusCode: 401,
      code: NotLoginException.codeForType(type),
      type,
      message: NotLoginException.describeType(type),
    });
    this.type = type;
    this.token = token;
  }

  private static codeForType(type: NotLoginType): XltErrorCode {
    const map: Record<NotLoginType, XltErrorCode> = {
      [NotLoginType.NOT_TOKEN]: "TOKEN_MISSING",
      [NotLoginType.INVALID_TOKEN]: "TOKEN_INVALID",
      [NotLoginType.TOKEN_TIMEOUT]: "TOKEN_TIMEOUT",
      [NotLoginType.TOKEN_FREEZE]: "TOKEN_FREEZE",
      [NotLoginType.BE_REPLACED]: "TOKEN_REPLACED",
      [NotLoginType.KICK_OUT]: "TOKEN_KICKED_OUT",
    };
    return map[type] ?? "TOKEN_INVALID";
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
