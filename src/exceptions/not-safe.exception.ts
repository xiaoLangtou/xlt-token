import { ForbiddenException } from "@nestjs/common";

export class NotSafeException extends ForbiddenException {
  readonly business: string;


  constructor(business: string) {
    super({
      statusCode: 403,
      type: 'NOT_SAFE',
      message: `二级认证未开启：${business}`,
    });
    this.business = business;
  }

}
