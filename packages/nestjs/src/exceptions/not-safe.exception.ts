import { ForbiddenException } from "@nestjs/common";

export class NotSafeException extends ForbiddenException {
  readonly business: string;

  constructor(business: string) {
    super({
      statusCode: 403,
      code: "SAFE_REQUIRED",
      business,
      message: `二级认证未开启：${business}`,
    });
    this.business = business;
  }
}
