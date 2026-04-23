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

export interface XltTokenModuleOptions {
  config?: Partial<XltTokenConfig>;
  store?: { useClass: new (...args: any[]) => XltTokenStore } | { useValue: XltTokenStore };
  strategy?: { useClass: new (...args: any[]) => TokenStrategy };
  isGlobal?: boolean;
  providers?: Provider[];
}

export interface XltTokenModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  useFactory: (...args: any[]) => Promise<XltTokenModuleOptions> | XltTokenModuleOptions;
  inject?: any[];
  store?: { useClass: new (...args: any[]) => XltTokenStore } | { useValue: XltTokenStore };
  strategy?: { useClass: new (...args: any[]) => TokenStrategy };
  isGlobal?: boolean;
  providers?: Provider[];
}

@Module({})
export class XltTokenModule {
  static forRoot(options: XltTokenModuleOptions = {}) {
    const { config: userConfig, store, strategy, isGlobal = false, providers = [] } = options;

    const configProvider: Provider = {
      provide: XLT_TOKEN_CONFIG,
      useValue: userConfig ? { ...DEFAULT_XLT_TOKEN_CONFIG, ...userConfig } : DEFAULT_XLT_TOKEN_CONFIG,
    };

    const storeProvider: Provider = !store
      ? { provide: XLT_TOKEN_STORE, useClass: MemoryStore }
      : 'useClass' in store
        ? { provide: XLT_TOKEN_STORE, useClass: store.useClass }
        : { provide: XLT_TOKEN_STORE, useValue: store.useValue };

    const strategyProvider: Provider = strategy?.useClass
      ? { provide: XLT_TOKEN_STRATEGY, useClass: strategy.useClass }
      : { provide: XLT_TOKEN_STRATEGY, useClass: UuidStrategy };

    const initProvider: Provider = {
      provide: 'XLT_TOKEN_INIT',
      useFactory: (stpLogic: StpLogic) => {
        setStpLogic(stpLogic);
        return true;
      },
      inject: [StpLogic],
    };

    const moduleDefinition = {
      module: XltTokenModule,
      providers: [configProvider, storeProvider, strategyProvider, StpLogic, initProvider, ...providers],
      exports: [XLT_TOKEN_CONFIG, XLT_TOKEN_STORE, XLT_TOKEN_STRATEGY, StpLogic],
      global: isGlobal,
    };

    return moduleDefinition;
  }

  static forRootAsync(options: XltTokenModuleAsyncOptions) {
    const { useFactory, inject = [], imports = [], store, strategy, isGlobal = false, providers = [] } = options;

    const asyncConfigProvider: Provider = {
      provide: XLT_TOKEN_CONFIG,
      useFactory: async (...args: any[]) => {
        const moduleOptions = await useFactory(...args);
        const userConfig = moduleOptions.config || {};
        return { ...DEFAULT_XLT_TOKEN_CONFIG, ...userConfig };
      },
      inject,
    };

    const storeProvider: Provider = !store
      ? { provide: XLT_TOKEN_STORE, useClass: MemoryStore }
      : 'useClass' in store
        ? { provide: XLT_TOKEN_STORE, useClass: store.useClass }
        : { provide: XLT_TOKEN_STORE, useValue: store.useValue };

    const strategyProvider: Provider = strategy?.useClass
      ? { provide: XLT_TOKEN_STRATEGY, useClass: strategy.useClass }
      : { provide: XLT_TOKEN_STRATEGY, useClass: UuidStrategy };

    const initProvider: Provider = {
      provide: 'XLT_TOKEN_INIT',
      useFactory: (stpLogic: StpLogic) => {
        setStpLogic(stpLogic);
        return true;
      },
      inject: [StpLogic],
    };

    const moduleDefinition = {
      module: XltTokenModule,
      imports,
      providers: [asyncConfigProvider, storeProvider, strategyProvider, StpLogic, initProvider, ...providers],
      exports: [XLT_TOKEN_CONFIG, XLT_TOKEN_STORE, XLT_TOKEN_STRATEGY, StpLogic],
      global: isGlobal,
    };

    return moduleDefinition;
  }
}
