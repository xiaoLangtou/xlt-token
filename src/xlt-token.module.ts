import { Module, ModuleMetadata, Provider } from '@nestjs/common';
import {
  DEFAULT_XLT_TOKEN_CONFIG,
  XLT_TOKEN_CONFIG,
  XLT_TOKEN_STORE,
  XLT_TOKEN_STRATEGY,
  XltTokenConfig,
} from './core/xlt-token-config';
import { MemoryStore } from './store/memory-store';
import { XltTokenStore } from './store/xlt-token-store.interface';
import { UuidStrategy } from './token/uuid-strategy';
import { TokenStrategy } from './token/token-strategy.interface';
import { StpLogic } from './auth/stp-logic';
import { setStpLogic } from './auth/stp-util';
import { StpInterface, XLT_STP_INTERFACE } from './perm/stp-interface';
import { StpPermLogic } from './perm/stp-perm-logic';

export interface XltTokenModuleOptions {
  config?: Partial<XltTokenConfig>;
  store?: { useClass: new (...args: any[]) => XltTokenStore } | { useValue: XltTokenStore };
  strategy?: { useClass: new (...args: any[]) => TokenStrategy };
  isGlobal?: boolean;
  providers?: Provider[];
  stpInterface?: new (...args: any[]) => StpInterface;
}

export interface XltTokenModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<XltTokenModuleOptions> | XltTokenModuleOptions;
  inject?: any[];
  store?: { useClass: new (...args: any[]) => XltTokenStore } | { useValue: XltTokenStore };
  strategy?: { useClass: new (...args: any[]) => TokenStrategy };
  isGlobal?: boolean;
  providers?: Provider[];
  stpInterface?: new (...args: any[]) => StpInterface;
}

@Module({})
export class XltTokenModule {
  private static createStoreProvider(
    store?: XltTokenModuleOptions['store'],
  ): Provider {
    if (!store) return { provide: XLT_TOKEN_STORE, useClass: MemoryStore };
    return 'useClass' in store
      ? { provide: XLT_TOKEN_STORE, useClass: store.useClass }
      : { provide: XLT_TOKEN_STORE, useValue: store.useValue };
  }

  private static createStrategyProvider(
    strategy?: XltTokenModuleOptions['strategy'],
  ): Provider {
    return strategy?.useClass
      ? { provide: XLT_TOKEN_STRATEGY, useClass: strategy.useClass }
      : { provide: XLT_TOKEN_STRATEGY, useClass: UuidStrategy };
  }

  private static createStpInterfaceProvider(
    stpInterface?: new (...args: any[]) => StpInterface,
  ): Provider {
    if (stpInterface) return { provide: XLT_STP_INTERFACE, useClass: stpInterface };
    return {
      provide: XLT_STP_INTERFACE,
      useValue: {
        getPermissionList: () => { throw new Error('StpInterface not registered: getPermissionList'); },
        getRoleList: () => { throw new Error('StpInterface not registered: getRoleList'); },
      },
    };
  }

  private static readonly initProvider: Provider = {
    provide: 'XLT_TOKEN_INIT',
    useFactory: (stpLogic: StpLogic) => {
      setStpLogic(stpLogic);
      return true;
    },
    inject: [StpLogic],
  };

  private static readonly moduleExports = [XLT_TOKEN_CONFIG, XLT_TOKEN_STORE, XLT_TOKEN_STRATEGY, StpLogic, StpPermLogic];

  static forRoot(options: XltTokenModuleOptions = {}) {
    const { config: userConfig, store, strategy, isGlobal = false, providers = [], stpInterface } = options;

    return {
      module: XltTokenModule,
      providers: [
        { provide: XLT_TOKEN_CONFIG, useValue: { ...DEFAULT_XLT_TOKEN_CONFIG, ...userConfig } },
        XltTokenModule.createStoreProvider(store),
        XltTokenModule.createStrategyProvider(strategy),
        XltTokenModule.createStpInterfaceProvider(stpInterface),
        StpLogic,
        XltTokenModule.initProvider,
        StpPermLogic,
        ...providers,
      ],
      exports: XltTokenModule.moduleExports,
      global: isGlobal,
    };
  }

  static forRootAsync(options: XltTokenModuleAsyncOptions) {
    const { useFactory, inject = [], imports = [], store, strategy, isGlobal = false, providers = [], stpInterface } = options;

    return {
      module: XltTokenModule,
      imports,
      providers: [
        {
          provide: XLT_TOKEN_CONFIG,
          useFactory: async (...args: any[]) => {
            const { config = {} } = await useFactory(...args);
            return { ...DEFAULT_XLT_TOKEN_CONFIG, ...config };
          },
          inject,
        },
        XltTokenModule.createStoreProvider(store),
        XltTokenModule.createStrategyProvider(strategy),
        XltTokenModule.createStpInterfaceProvider(stpInterface),
        StpLogic,
        XltTokenModule.initProvider,
        StpPermLogic,
        ...providers,
      ],
      exports: XltTokenModule.moduleExports,
      global: isGlobal,
    };
  }
}
