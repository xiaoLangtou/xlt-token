import {
  createXltToken,
  MemoryStore,
  XltMode,
  type RouteAuthPolicy,
  type XltTokenConfig,
} from '@xlt-token/express';
import { createAuditHooks } from './audit-hooks';
import { DemoStpInterface } from '../stp/demo-stp-interface';

export class AppConfig {
  readonly port = Number(process.env.PORT ?? 3000);
  readonly defaultCheck = process.env.XLT_DEFAULT_CHECK !== 'false';

  getTokenConfig(): Partial<XltTokenConfig> {
    return {
      tokenName: 'authorization',
      tokenPrefix: 'Bearer ',
      timeout: 7 * 24 * 60 * 60,
      activeTimeout: 2 * 60 * 60,
      defaultCheck: this.defaultCheck,
      deviceConcurrent: true,
      isConcurrent: true,
      isShare: false,
    };
  }
}

export function createExampleXlt() {
  const config = new AppConfig();

  const xlt = createXltToken({
    config: config.getTokenConfig(),
    store: new MemoryStore(),
    stpInterface: new DemoStpInterface(),
    hooks: createAuditHooks(),
  });

  return { config, xlt };
}

export function createRoutePolicies(): RouteAuthPolicy[] {
  return [
    { match: '/auth/protected-by-check-login', requireLogin: true },
    { match: '/whitelist/private', requireLogin: true },

    { match: '/permission/read', permissions: { list: ['user:read'], mode: XltMode.AND } },
    { match: '/permission/delete', permissions: { list: ['user:read', 'user:delete'], mode: XltMode.AND } },
    { match: '/permission/order-create', permissions: { list: ['order:create'], mode: XltMode.AND } },

    { match: '/role/admin-only', roles: { list: ['admin'], mode: XltMode.AND } },
    { match: '/role/admin-or-super', roles: { list: ['admin', 'super'], mode: XltMode.OR } },

    { match: '/safe/transfer', methods: ['POST'], safeBusiness: 'pay' },
    { match: '/safe/delete-account', methods: ['POST'], safeBusiness: 'deleteAccount' },

    { match: '/admin/hooks', roles: { list: ['admin'], mode: XltMode.AND } },
    { match: '/admin/dashboard', roles: { list: ['admin'], mode: XltMode.AND } },
  ];
}

export function createIgnoredRoutes() {
  return [
    '/',
    '/demo',
    '/demo/',
    '/auth/login',
    '/device/login',
    '/session/login-replace',
    '/session/login-share',
    '/public/health',
    '/public/product',
    '/whitelist/public',
    '/temp-token/create',
    '/temp-token/consume',
  ];
}
