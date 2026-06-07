import { copyFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { defineConfig } from 'vitepress';
import { transformerTwoslash } from '@shikijs/vitepress-twoslash';
// @ts-ignore
import { createFileSystemTypesCache } from '@shikijs/vitepress-twoslash/cache-fs';
// @ts-ignore
import { FILE_IMPORTS } from './twoslash.ts';

// @ts-ignore
const dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(dir, '../..')
const docsRoot = resolve(root, 'docs')

const rawPages: Record<string, string> = {
  '/guide/getting-started': '01-getting-started.md',
  '/guide/architecture': '02-architecture.md',
  '/guide/migration-2-0': 'migration-2.0.md',
  '/guide/mcp-server': '20-mcp-server.md',
  '/guide/llms': '21-llms-txt.md',
  '/guide/skills': '22-skills.md',
  '/core/configuration': '03-configuration.md',
  '/core/getting-started': '10-core-getting-started.md',
  '/core/core-api': '04-core-api.md',
  '/core/permissions-and-session': '11-permissions-and-session.md',
  '/core/storage': '06-storage.md',
  '/core/token-strategy': '07-token-strategy.md',
  '/core/exceptions': '08-exceptions.md',
  '/core/recipes': '09-recipes.md',
  '/core/multi-device': '14-multi-device.md',
  '/core/secondary-auth': '15-secondary-auth.md',
  '/core/jwt-strategy': '16-jwt-strategy.md',
  '/core/hooks-and-observability': '17-hooks-and-observability.md',
  '/adapters': '13-adapters-overview.md',
  '/adapters/nestjs/getting-started': '10-nestjs-getting-started.md',
  '/adapters/nestjs/module-config': '12-nestjs-module-config.md',
  '/adapters/nestjs/guards-and-decorators': '05-guards-and-decorators.md',
  '/adapters/express': '18-express-adapter.md',
  '/reference/changelog': 'CHANGELOG.md',
  '/reference/src-reference': 'SRC-REFERENCE.md',
  '/reference/llms': '19-ai-coding-agents.md',
}

function generateRawMarkdownFiles() {
  for (const [routePath, sourceFile] of Object.entries(rawPages)) {
    const target = join(docsRoot, 'public', 'raw', `${routePath.slice(1)}.md`)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(resolve(docsRoot, sourceFile), target)
  }
}

generateRawMarkdownFiles()

// @ts-ignore
export default defineConfig({
  title: 'xlt-token',
  description: '框架无关 Token 鉴权库，灵感来源于 Sa-Token。核心 @xlt-token/core + NestJS / Express 适配器，轻量、可插拔。',
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
              '@xlt-token/express': ['packages/express/src/index.ts'],
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
    ['meta', { name: 'og:description', content: '框架无关 Token 鉴权库，NestJS 与 Express 可直接接入' }],
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

  srcExclude: ['README.md', 'archive/**', 'juejin/**', 'public/raw/**'],

  themeConfig: {
    siteTitle: 'xlt-token',
    logo: { src: '/logo.png', width: 24, height: 24 },

    outline: {
      level: [2, 3],
      label: '本页导航',
    },

    nav: [
      { text: 'AI 指南', link: '/reference/llms' },
      {
        text: 'v1.0.0',
        items: [
          { text: '更新日志', link: '/reference/changelog' },
          { text: 'GitHub Releases', link: 'https://github.com/xiaoLangtou/xlt-token/releases' },
          { text: 'npm', link: 'https://www.npmjs.com/package/xlt-token' },
        ],
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: [
            { text: '选择接入方式', link: '/guide/getting-started' },
            { text: '架构设计', link: '/guide/architecture' },
            { text: '1.0 迁移指南', link: '/guide/migration-2-0' },
          ],
        },
        {
          text: 'Agents',
          items: [
            { text: 'LLMs.txt', link: '/guide/llms' },
          ],
        },
      ],
      '/core/': [
        {
          text: '核心（@xlt-token/core）',
          collapsed: false,
          items: [
            { text: '快速开始', link: '/core/getting-started' },
            { text: '配置参考', link: '/core/configuration' },
            { text: '核心 API', link: '/core/core-api' },
            { text: '权限与会话', link: '/core/permissions-and-session' },
            { text: '存储层', link: '/core/storage' },
            { text: 'Token 策略', link: '/core/token-strategy' },
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
      '/adapters/': [
        {
          text: '适配器总览',
          collapsed: false,
          items: [
            { text: '总览', link: '/adapters' },
          ],
        },
        {
          text: 'NestJS',
          collapsed: false,
          items: [
            { text: '快速开始', link: '/adapters/nestjs/getting-started' },
            { text: '模块配置', link: '/adapters/nestjs/module-config' },
            { text: '守卫与装饰器', link: '/adapters/nestjs/guards-and-decorators' },
          ],
        },
        {
          text: 'Express',
          collapsed: false,
          items: [
            { text: 'Express 适配器', link: '/adapters/express' },
          ],
        },
        {
          text: 'Core 相关能力',
          collapsed: false,
          items: [
            { text: '权限与会话', link: '/core/permissions-and-session' },
            { text: 'Redis 存储', link: '/core/storage' },
            { text: 'JWT 策略', link: '/core/jwt-strategy' },
            { text: '异常处理', link: '/core/exceptions' },
            { text: '场景手册', link: '/core/recipes' },
          ],
        },
      ],
      '/reference/': [
        {
          text: '参考',
          items: [
            { text: 'AI 编码代理指南', link: '/reference/llms' },
            { text: '更新日志', link: '/reference/changelog' },
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
    '20-mcp-server.md': 'guide/mcp-server.md',
    '21-llms-txt.md': 'guide/llms.md',
    '22-skills.md': 'guide/skills.md',
    '03-configuration.md': 'core/configuration.md',
    '10-core-getting-started.md': 'core/getting-started.md',
    '10-nestjs-getting-started.md': 'adapters/nestjs/getting-started.md',
    '12-nestjs-module-config.md': 'adapters/nestjs/module-config.md',
    '13-adapters-overview.md': 'adapters/index.md',
    '18-express-adapter.md': 'adapters/express.md',
    '04-core-api.md': 'core/core-api.md',
    '05-guards-and-decorators.md': 'adapters/nestjs/guards-and-decorators.md',
    '06-storage.md': 'core/storage.md',
    '07-token-strategy.md': 'core/token-strategy.md',
    '08-exceptions.md': 'core/exceptions.md',
    '09-recipes.md': 'core/recipes.md',
    '11-permissions-and-session.md': 'core/permissions-and-session.md',
    '14-multi-device.md': 'core/multi-device.md',
    '15-secondary-auth.md': 'core/secondary-auth.md',
    '16-jwt-strategy.md': 'core/jwt-strategy.md',
    '17-hooks-and-observability.md': 'core/hooks-and-observability.md',
    '19-ai-coding-agents.md': 'reference/llms.md',
    'CHANGELOG.md': 'reference/changelog.md',
    'SRC-REFERENCE.md': 'reference/src-reference.md',
  },
})
