// 忽略校验装饰器

import { SetMetadata } from '@nestjs/common';
import { XLT_IGNORE_KEY } from '../const';

export const XltIgnore = () => SetMetadata(XLT_IGNORE_KEY, true);
