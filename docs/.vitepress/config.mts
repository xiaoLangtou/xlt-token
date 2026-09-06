import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
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
const siteUrl = 'https://xlt-token.doc.weipc0110.cn'

function toCanonicalUrl(page: string) {
  const pathname = page === 'index.md'
    ? '/'
    : `/${page.replace(/index\.md$/, '').replace(/\.md$/, '')}`

  return new URL(pathname, siteUrl).href
}



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
            '@xlt-token/store-redis': ['packages/store-redis/src/index.ts'],
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
  'v2.3.0.md',
  'v2.2.0.md',
  'v2.1.0.md',
  'v1.2.1.md',
  'v1.2.0.md',
  'v1.1.0.md',
  'v1.0.2.md',
  'v1.0.0.md',
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
  // @ts-ignore
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


export default defineConfig({
  title: 'xlt-token',
  description: '框架无关 Token 鉴权库，灵感来源于 Sa-Token。核心 @xlt-token/core + NestJS / Express 适配器，轻量、可插拔。',
  lang: 'zh-CN',
  base: '/',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,
  appearance: true,
  sitemap: {
    hostname: siteUrl,
  },

  transformHead({ page, title, description }) {
    const canonicalUrl = toCanonicalUrl(page)
    const socialTitle = title

    return [
      ['link', { rel: 'canonical', href: canonicalUrl }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { property: 'og:site_name', content: 'xlt-token' }],
      ['meta', { property: 'og:locale', content: 'zh_CN' }],
      ['meta', { property: 'og:url', content: canonicalUrl }],
      ['meta', { property: 'og:title', content: socialTitle }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { name: 'twitter:card', content: 'summary' }],
      ['meta', { name: 'twitter:title', content: socialTitle }],
      ['meta', { name: 'twitter:description', content: description }],
    ]
  },

  vite: {
    plugins: [releaseCodeHtmlPlugin()],
    server: {
      fs: {
        allow: [root],
      },
    },
  },
  // @ts-ignore
  markdown,

  head: [
    ['link', { rel: 'icon', type: 'image/png', href: '/logo.png' }],
    ['meta', { name: 'theme-color', content: '#4f46e5' }],
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

  srcExclude: ['README.md', 'archive/**', 'juejin/**', 'superpowers/**'],

  themeConfig: {
    siteTitle: 'xlt-token',
    logo: { src: '/logo.png', width: 24, height: 24 },

    outline: {
      level: [2, 3],
      label: '本页导航',
    },

    nav: [
      { text: '快速开始', link: '/guide/getting-started' },
      { text: 'Core', link: '/core/getting-started' },
      { text: 'Redis Store', link: '/store-redis/' },
      {
        text: '框架适配',
        items: [
          { text: 'NestJS', link: '/adapters/nestjs/getting-started' },
          { text: 'Express', link: '/adapters/express' },
          { text: 'Fastify', link: '/adapters/fastify' },
        ],
      },
      { text: 'AI 指南', link: '/reference/llms' },
      {
        text: 'v2.3.0',
        items: [
          { text: '更新日志', link: '/reference/changelog' },
          { text: 'GitHub Releases', link: 'https://github.com/xiaoLangtou/xlt-token/releases' },
          { text: 'npm', link: 'https://www.npmjs.com/package/xlt-token' },
        ],
      },
    ],

    sidebar: [
      {
        text: '快速开始',
        collapsed: false,
        items: [
          { text: '选择接入方式', link: '/guide/getting-started' },
        ],
      },
      {
        text: '核心能力',
        collapsed: false,
        items: [
          { text: 'Core 快速开始', link: '/core/getting-started' },
          { text: '配置参考', link: '/core/configuration' },
          { text: '核心 API', link: '/core/core-api' },
          { text: '权限与会话', link: '/core/permissions-and-session' },
          { text: 'Store 契约与内存存储', link: '/core/storage' },
          { text: 'Token 策略', link: '/core/token-strategy' },
          { text: '多端登录', link: '/core/multi-device' },
          { text: '二级认证', link: '/core/secondary-auth' },
          { text: 'JWT 策略', link: '/core/jwt-strategy' },
          { text: 'Hooks 与观测性', link: '/core/hooks-and-observability' },
          { text: '异常处理', link: '/core/exceptions' },
          { text: '场景手册', link: '/core/recipes' },
        ],
      },
      {
        text: 'Redis Store',
        collapsed: false,
        items: [
          { text: '完整使用指南', link: '/store-redis/' },
        ],
      },
      {
        text: '框架适配',
        collapsed: false,
        items: [
          { text: '适配器总览', link: '/adapters' },
          { text: 'NestJS 快速开始', link: '/adapters/nestjs/getting-started' },
          { text: 'NestJS 模块配置', link: '/adapters/nestjs/module-config' },
          { text: 'NestJS 守卫与装饰器', link: '/adapters/nestjs/guards-and-decorators' },
          { text: 'Express 完整指南', link: '/adapters/express' },
          { text: 'Fastify 完整指南', link: '/adapters/fastify' },
        ],
      },
      {
        text: '进阶指南',
        collapsed: false,
        items: [
          { text: '架构设计', link: '/guide/architecture' },
          { text: '工程化门禁', link: '/guide/engineering' },
          { text: '发布检查清单', link: '/guide/release-checklist' },
          { text: '多实例与适配器契约', link: '/guide/multi-instance-contract' },
          { text: 'Cookie 契约决策', link: '/guide/cookie-contract' },
          { text: '迁移指南', link: '/guide/migration-2-0' },
          { text: 'LLMs.txt', link: '/guide/llms' },
          { text: 'Skills 指南', link: '/guide/skills' },
          { text: 'MCP Server', link: '/guide/mcp-server' },
        ],
      },
      {
        text: '参考',
        collapsed: true,
        items: [
          { text: 'AI 编码代理指南', link: '/reference/llms' },
          { text: '更新日志', link: '/reference/changelog' },
          { text: '源码参考', link: '/reference/src-reference' },
        ],
      },
    ],

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
