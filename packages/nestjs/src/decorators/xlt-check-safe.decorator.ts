import { SetMetadata } from "@nestjs/common";

export const XLT_CHECK_SAFE_KEY = "XLT_CHECK_SAFE";

export const XltCheckSafe = (business: string) => {
  return SetMetadata(XLT_CHECK_SAFE_KEY, business);
};
