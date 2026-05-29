import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig } from 'vitepress';
import { transformerTwoslash } from '@shikijs/vitepress-twoslash';
// @ts-ignore
import { createFileSystemTypesCache } from '@shikijs/vitepress-twoslash/cache-fs';
import { FILE_IMPORTS } from './twoslash.ts'

// @ts-ignore
const dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(dir, '../..')

// @ts-ignore
export default defineConfig({
  title: 'xlt-token',
  description: '框架无关 Token 鉴权库，灵感来源于 Sa-Token。核心 @xlt-token/core + NestJS 适配 @xlt-token/nestjs，轻量、可插拔。',
  lang: 'zh-CN',
  base: '/xlt-token/',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  appearance: true,

  vite: {
    server: {
      fs: {
        allow: [root],
      },
    },
  },

  markdown: {
    theme: {
      // 浅色：柔和白底
      light: 'vitesse-light',
      // 深色：高对比暗色
      dark: 'vitesse-dark',
    },
    lineNumbers: true,
    codeTransformers: [
      transformerTwoslash({
        twoslashOptions: {
          compilerOptions: {
            ignoreDeprecations: '5.0',
            experimentalDecorators: true,
            emitDecoratorMetadata: true,
            baseUrl: root,
            paths: {
              '@xlt-token/nestjs': ['packages/nestjs/src/index.ts'],
              '@xlt-token/core': ['packages/core/src/index.ts'],
            },
          },
          handbookOptions: {
            noErrors: true,
          },
        },
        // @ts-ignore
        includesMap: new Map([['imports', `// ---cut-start---\n${FILE_IMPORTS}\n// ---cut-end---`]]),
        typesCache: createFileSystemTypesCache({
          dir: resolve(dir, 'cache/twoslash'),
        }),
      }),
    ],
    // @ts-ignore
    languages: ['js', 'jsx', 'ts', 'tsx'],
  },

  head: [
    ['link', { rel: 'icon', href: '/xlt-token/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#4f46e5' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: 'xlt-token' }],
    ['meta', { name: 'og:description', content: '框架无关 Token 鉴权库，NestJS 一行接入' }],
    // Geist 字体（fonts.loli.net 国内镜像）
    ['link', { rel: 'preconnect', href: 'https://fonts.loli.net' }],
    ['link', { rel: 'preconnect', href: 'https://gstatic.loli.net', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.loli.net/css2?family=Geist:wght@300;400;500;600;700;800&family=Geist+Mono:wght@400;500;600&display=swap',
      },
    ],
  ],

  srcExclude: ['README.md', 'archive/**'],

  themeConfig: {
    siteTitle: 'xlt-token',
    logo: { src: '/logo.png', width: 24, height: 24 },

    outline: {
      level: [2, 3],
      label: '本页导航',
    },

    nav: [
      { text: '指南', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: '核心', link: '/core/core-api', activeMatch: '/core/' },
      { text: '参考', link: '/reference/src-reference', activeMatch: '/reference/' },
      {
        text: 'v1.0.0-rc.2',
        items: [
          { text: '更新日志', link: 'https://github.com/xiaoLangtou/xlt-token/blob/master/CHANGELOG.md' },
          { text: 'GitHub Releases', link: 'https://github.com/xiaoLangtou/xlt-token/releases' },
          { text: 'npm', link: 'https://www.npmjs.com/package/xlt-token' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '入门',
          items: [
            { text: '快速开始', link: '/guide/getting-started' },
            { text: '架构设计', link: '/guide/architecture' },
            { text: '配置参考', link: '/guide/configuration' },
            { text: '2.0 迁移指南', link: '/guide/migration-2-0' },
          ],
        },
      ],
      '/core/': [
        {
          text: '核心（@xlt-token/core）',
          collapsed: false,
          items: [
            { text: '核心 API', link: '/core/core-api' },
            { text: '权限与会话', link: '/core/permissions-and-session' },
            { text: '存储层', link: '/core/storage' },
            { text: 'Token 策略', link: '/core/token-strategy' },
          ],
        },
        {
          text: 'NestJS 集成（@xlt-token/nestjs）',
          collapsed: false,
          items: [
            { text: '守卫与装饰器', link: '/core/guards-and-decorators' },
          ],
        },
        {
          text: '1.1.0 新特性',
          collapsed: false,
          items: [
            { text: '多端登录', link: '/core/multi-device' },
            { text: '二级认证', link: '/core/secondary-auth' },
            { text: 'JWT 策略', link: '/core/jwt-strategy' },
            { text: 'Hooks 与观测性', link: '/core/hooks-and-observability' },
          ],
        },
        {
          text: '进阶',
          collapsed: false,
          items: [
            { text: '异常处理', link: '/core/exceptions' },
            { text: '场景手册', link: '/core/recipes' },
          ],
        },
      ],
      '/reference/': [
        {
          text: '参考',
          items: [
            { text: '源码参考', link: '/reference/src-reference' },
          ],
        },
      ],
    },

    search: {
      provider: 'local',
      options: {
        locales: {
          root: {
            translations: {
              button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
              modal: {
                noResultsText: '无匹配结果',
                resetButtonTitle: '清除查询',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                  closeText: '关闭',
                },
              },
            },
          },
        },
      },
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/xiaoLangtou/xlt-token' },
    ],

    editLink: {
      pattern: 'https://github.com/xiaoLangtou/xlt-token/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页',
    },

    lastUpdated: {
      text: '最后更新于',
      formatOptions: { dateStyle: 'short', timeStyle: 'short' },
    },

    docFooter: { prev: '上一篇', next: '下一篇' },

    footer: {
      message: '基于 MIT 协议发布',
      copyright: `Copyright © ${new Date().getFullYear()} xltorg`,
    },

    darkModeSwitchLabel: '主题',
    lightModeSwitchTitle: '切换到浅色模式',
    darkModeSwitchTitle: '切换到深色模式',
    sidebarMenuLabel: '菜单',
    returnToTopLabel: '回到顶部',
    externalLinkIcon: true,
  },

  rewrites: {
    'migration-2.0.md': 'guide/migration-2-0.md',
    '01-getting-started.md': 'guide/getting-started.md',
    '02-architecture.md': 'guide/architecture.md',
    '03-configuration.md': 'guide/configuration.md',
    '04-core-api.md': 'core/core-api.md',
    '05-guards-and-decorators.md': 'core/guards-and-decorators.md',
    '06-storage.md': 'core/storage.md',
    '07-token-strategy.md': 'core/token-strategy.md',
    '08-exceptions.md': 'core/exceptions.md',
    '09-recipes.md': 'core/recipes.md',
    '11-permissions-and-session.md': 'core/permissions-and-session.md',
    '14-multi-device.md': 'core/multi-device.md',
    '15-secondary-auth.md': 'core/secondary-auth.md',
    '16-jwt-strategy.md': 'core/jwt-strategy.md',
    '17-hooks-and-observability.md': 'core/hooks-and-observability.md',
    'SRC-REFERENCE.md': 'reference/src-reference.md',
  },
})
