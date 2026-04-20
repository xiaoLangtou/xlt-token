export interface XltTokenConfig {
  tokenName: string;
  timeout: number;
  activeTimeout: number;
  isConcurrent: boolean;
  isShare: boolean;
  tokenStyle: 'uuid' | 'simple-uuid' | 'random-32';
  isReadHeader: boolean;
  isReadCookie: boolean;
  isReadQuery: boolean;
  tokenPrefix: string;
  defaultCheck: boolean;
}

export const DEFAULT_XLT_TOKEN_CONFIG: XltTokenConfig = {
  tokenName: 'authorization',
  timeout: 2592000,
  activeTimeout: -1,
  isConcurrent: true,
  isShare: true,
  tokenStyle: 'uuid',
  isReadHeader: true,
  isReadCookie: false,
  isReadQuery: false,
  tokenPrefix: 'Bearer ',
  defaultCheck: true,
};

export const XLT_TOKEN_CONFIG = 'XLT_TOKEN_CONFIG';
export const XLT_TOKEN_STORE = 'XLT_TOKEN_STORE';
export const XLT_TOKEN_STRATEGY = 'XLT_TOKEN_STRATEGY';
