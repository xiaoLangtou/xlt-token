import { join } from 'node:path';
import express from 'express';
import { xltErrorHandler, xltMiddleware } from '@xlt-token/express';
import { createExampleXlt, createIgnoredRoutes, createRoutePolicies } from './config/app-config';
import { demoErrorHandler } from './middleware/demo-error-handler';
import { createAdminRouter } from './routes/admin';
import { createAuthRouter } from './routes/auth';
import { createDeviceRouter } from './routes/device';
import { createPermissionRouter } from './routes/permission';
import { createProfileRouter } from './routes/profile';
import { createPublicRouter } from './routes/public';
import { createRoleRouter } from './routes/role';
import { createSafeRouter } from './routes/safe';
import { createSessionRouter } from './routes/session';
import { createTempTokenRouter } from './routes/temp-token';
import { createWhitelistRouter } from './routes/whitelist';

export function createApp() {
  const { config, xlt } = createExampleXlt();
  const app = express();

  app.use(express.json());
  app.use('/demo', express.static(join(__dirname, '..', 'public', 'demo')));

  app.get('/', (_req, res) => {
    res.redirect('/demo/');
  });

  app.use(
    xltMiddleware(xlt, {
      ignore: createIgnoredRoutes(),
      policies: createRoutePolicies(),
    }),
  );

  app.use('/auth', createAuthRouter());
  app.use('/public', createPublicRouter());
  app.use('/permission', createPermissionRouter());
  app.use('/role', createRoleRouter());
  app.use('/safe', createSafeRouter());
  app.use('/device', createDeviceRouter());
  app.use('/session', createSessionRouter());
  app.use('/whitelist', createWhitelistRouter());
  app.use('/profile', createProfileRouter());
  app.use('/admin', createAdminRouter());
  app.use('/temp-token', createTempTokenRouter());

  app.use(xltErrorHandler());
  app.use(demoErrorHandler);

  return { app, config, xlt };
}
