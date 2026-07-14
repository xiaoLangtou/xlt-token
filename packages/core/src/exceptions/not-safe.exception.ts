import { XltError } from "./xlt-error.js";

export class NotSafeException extends XltError {
  readonly status = 403;
  readonly business: string;

  constructor(business: string) {
    super(`二级认证未开启：${business}`, "NOT_SAFE", 403);
    this.business = business;
  }
}
