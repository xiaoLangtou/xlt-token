import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createMarkdownRenderer, defineConfig } from 'vitepress';
import { transformerTwoslash } from '@shikijs/vitepress-twoslash';
// @ts-ignore
import { createFileSystemTypesCache } from '@shikijs/vitepress-twoslash/cache-fs';
// @ts-ignore
import { FILE_IMPORTS } from './twoslash.ts';

// @ts-ignore
const dir = dirname(fileURLToPath(import.meta.url))
const root = resolve(dir, '../..')
const docsRoot = resolve(root, 'docs')

const rawPages: string[] = [
  '/guide/getting-started',
  '/guide/architecture',
  '/guide/migration-2-0',
  '/guide/mcp-server',
  '/guide/mcp-server',
  '/guide/llms',
  '/guide/skills',
  '/guide/relative-time-integration',
  '/core/configuration',
  '/core/getting-started',
  '/core/core-api',
  '/core/permissions-and-session',
  '/core/storage',
  '/core/token-strategy',
  '/core/exceptions',
  '/core/recipes',
  '/core/multi-device',
  '/core/secondary-auth',
  '/core/jwt-strategy',
  '/core/hooks-and-observability',
  '/adapters/index',
  '/adapters/nestjs/getting-started',
  '/adapters/nestjs/module-config',
  '/adapters/nestjs/guards-and-decorators',
  '/adapters/express',
  '/reference/changelog',
  '/reference/src-reference',
  '/reference/llms',
]

function generateRawMarkdownFiles() {
  for (const routePath of rawPages) {
    const source = join(docsRoot, `${routePath.slice(1)}.md`)
    const target = join(docsRoot, 'public', 'raw', `${routePath.slice(1)}.md`)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(source, target)
  }
}

generateRawMarkdownFiles()

const markdown = {
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
}

const virtualReleaseCodeHtmlId = 'virtual:xlt-release-code-html'
const resolvedVirtualReleaseCodeHtmlId = `\0${virtualReleaseCodeHtmlId}`
const releaseSources = [
  'v1.0.2.md',
  'v1.0.0-rc.3.md',
  'v1.0.0-rc.2.md',
  'v1.0.0-rc.1.md',
]

function releaseCodeHtmlPlugin() {
  let codeHtml: Record<string, string> | undefined

  return {
    name: 'xlt-release-code-html',
    resolveId(id: string) {
      if (id === virtualReleaseCodeHtmlId) {
        return resolvedVirtualReleaseCodeHtmlId
      }
    },
    async load(id: string) {
      if (id !== resolvedVirtualReleaseCodeHtmlId) return

      codeHtml ??= await renderReleaseCodeHtml()

      return `export default ${JSON.stringify(codeHtml)}`
    },
  }
}

async function renderReleaseCodeHtml() {
  const renderer = await createMarkdownRenderer(docsRoot, markdown, '/xlt-token/')
  const codeHtml: Record<string, string> = {}

  for (const source of releaseSources) {
    const raw = readFileSync(resolve(root, '.github/releases', source), 'utf8')
    const release = parseReleaseCodeBlocks(raw)

    release.codeBlocks.forEach((block) => {
      const fence = `\`\`\`${block.lang}\n${block.code.trim()}\n\`\`\``
      codeHtml[codeBlockKey(release.version, block.sectionIndex, block.blockIndex)] = renderer.render(fence).trim()
    })
  }

  return codeHtml
}

function parseReleaseCodeBlocks(raw: string) {
  const lines = raw.split(/\r?\n/)
  const title = lines.find(line => line.startsWith('# ')) ?? ''
  const version = title.match(/`([^`]+)`/)?.[1] ?? title.replace(/^#\s+Release\s+/, '').trim()
  const codeBlocks: Array<{ sectionIndex: number; blockIndex: number; lang: string; code: string }> = []
  let sectionIndex = -1
  let blockIndex = -1
  let lastBlockType: 'list' | 'table' | 'code' | 'paragraph' | 'subheading' | undefined
  let currentBlock: { sectionIndex: number; blockIndex: number; lang: string; code: string } | undefined

  for (const line of lines) {
    const trimmed = line.trim()

    if (line.startsWith('## ')) {
      sectionIndex += 1
      blockIndex = -1
      lastBlockType = undefined
      currentBlock = undefined
      continue
    }

    if (sectionIndex < 0 || !trimmed || trimmed === '---' || trimmed.startsWith('**Full Changelog**')) {
      continue
    }

    if (trimmed.startsWith('```')) {
      if (currentBlock) {
        codeBlocks.push(currentBlock)
        currentBlock = undefined
        lastBlockType = 'code'
      }
      else {
        blockIndex += 1
        currentBlock = {
          sectionIndex,
          blockIndex,
          lang: trimmed.replace(/^```/, '').trim(),
          code: '',
        }
      }
      continue
    }

    if (currentBlock) {
      currentBlock.code += `${line}\n`
      continue
    }

    if (trimmed.startsWith('### ')) {
      blockIndex += 1
      lastBlockType = 'subheading'
      continue
    }

    if (trimmed.startsWith('|')) {
      if (trimmed.includes('---')) continue
      if (lastBlockType !== 'table') blockIndex += 1
      lastBlockType = 'table'
      continue
    }

    if (trimmed.startsWith('- ')) {
      if (lastBlockType !== 'list') blockIndex += 1
      lastBlockType = 'list'
      continue
    }

    blockIndex += 1
    lastBlockType = 'paragraph'
  }

  return { version, codeBlocks }
}

function codeBlockKey(version: string, sectionIndex: number, blockIndex: number) {
  return `${version}:${sectionIndex}:${blockIndex}`
}

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
    plugins: [releaseCodeHtmlPlugin()],
    server: {
      fs: {
        allow: [root],
      },
    },
  },

  markdown,

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
            { text: '相对时间集成方案', link: '/guide/relative-time-integration' },
          ],
        },
        {
          text: 'Agents',
          items: [
            { text: 'LLMs.txt', link: '/guide/llms' },
            { text: 'Skills 指南', link: '/guide/skills' },
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


})
