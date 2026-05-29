import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { XltTokenGuard, XltTokenModule } from '@xlt-token/nestjs';
import { AppConfigService, buildAsyncModuleOptions } from './config/app-config.service';
import { ExampleConfigModule } from './config/example-config.module';
import { XltTokenExceptionFilter } from './filters/xlt-token-exception.filter';
import { BusinessLoginGuard } from './guards/business-login.guard';
import { ProfileLoginGuard } from './guards/profile-login.guard';
import { AuthController } from './auth/auth.controller';
import { PublicController } from './public/public.controller';
import { PermissionController } from './permission/permission.controller';
import { RoleController } from './role/role.controller';
import { SafeController } from './safe/safe.controller';
import { DeviceController } from './device/device.controller';
import { SessionController } from './session/session.controller';
import { WhitelistController } from './whitelist/whitelist.controller';
import { ProfileController } from './profile/profile.controller';
import { AdminController } from './admin/admin.controller';
import { TempTokenController } from './temp-token/temp-token.controller';

@Module({
  imports: [
    ExampleConfigModule,
    XltTokenModule.forRootAsync({
      imports: [ExampleConfigModule],
      ...buildAsyncModuleOptions(),
      inject: [AppConfigService],
      useFactory: (cfg: AppConfigService) => ({ config: cfg.getTokenConfig() }),
    }),
  ],
  controllers: [
    AuthController,
    PublicController,
    PermissionController,
    RoleController,
    SafeController,
    DeviceController,
    SessionController,
    WhitelistController,
    ProfileController,
    AdminController,
    TempTokenController,
  ],
  providers: [
    BusinessLoginGuard,
    ProfileLoginGuard,
    { provide: APP_GUARD, useClass: XltTokenGuard },
    { provide: APP_FILTER, useClass: XltTokenExceptionFilter },
  ],
})
export class AppModule {}
