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
  permCacheTimeout?: number; // 权限缓存时间 0 = 不缓存，-1 = 永久，默认 0
  offlineRecordEnabled?: boolean;  // 是否记录下线原因，默认 false
  offlineRecordTimeout?: number;   // 下线记录保留秒数，默认 3600
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
  permCacheTimeout: 0,
  offlineRecordEnabled: false,
  offlineRecordTimeout: 3600,
};

export const XLT_TOKEN_CONFIG = 'XLT_TOKEN_CONFIG';
export const XLT_TOKEN_STORE = 'XLT_TOKEN_STORE';
export const XLT_TOKEN_STRATEGY = 'XLT_TOKEN_STRATEGY';
