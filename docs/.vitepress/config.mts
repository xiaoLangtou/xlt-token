import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'xlt-token',
  description: 'NestJS Token 鉴权库，灵感来源于 Sa-Token。轻量、可插拔、零业务侵入。',
  lang: 'zh-CN',
  base: '/xlt-token/',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: true,

  head: [
    ['link', { rel: 'icon', href: '/xlt-token/favicon.ico' }],
    ['meta', { name: 'theme-color', content: '#16a34a' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:title', content: 'xlt-token' }],
    ['meta', { name: 'og:description', content: 'NestJS Token 鉴权库' }],
    // Geist 字体（fonts.loli.net 国内镜像，替代 Google Fonts）
    ['link', { rel: 'preconnect', href: 'https://fonts.loli.net' }],
    ['link', { rel: 'preconnect', href: 'https://gstatic.loli.net', crossorigin: '' }],
    [
      'link',
      {
        rel: 'stylesheet',
        href: 'https://fonts.loli.net/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap',
      },
    ],
  ],

  // docs 目录下的 README.md 交给 GitHub 浏览；站点首页用 index.md
  srcExclude: ['README.md', 'archive/README.md'],

  themeConfig: {
    siteTitle: 'xlt-token',
    outline: {
      level: [2, 3],
      label: '本页导航',
    },

    nav: [
      { text: '指南', link: '/guide/getting-started', activeMatch: '/guide/' },
      { text: '核心', link: '/core/core-api', activeMatch: '/core/' },
      { text: '参考', link: '/reference/src-reference', activeMatch: '/reference/' },
      { text: '路线图', link: '/roadmap/p1', activeMatch: '/roadmap/' },
      {
        text: 'v1.0.0-rc.1',
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
          ],
        },
      ],
      '/core/': [
        {
          text: '核心能力',
          items: [
            { text: '核心 API', link: '/core/core-api' },
            { text: '守卫与装饰器', link: '/core/guards-and-decorators' },
            { text: '权限与会话', link: '/core/permissions-and-session' },
            { text: '存储层', link: '/core/storage' },
            { text: 'Token 策略', link: '/core/token-strategy' },
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
        {
          text: '归档',
          collapsed: true,
          items: [
            { text: '历史路线图', link: '/reference/archive/roadmap' },
            { text: '接入迁移（旧）', link: '/reference/archive/integration' },
            { text: '实现现状快照', link: '/reference/archive/status' },
            { text: 'npm 抽包记录', link: '/reference/archive/npm-package' },
          ],
        },
      ],
      '/roadmap/': [
        {
          text: '路线图',
          items: [
            { text: 'P1 权限与会话', link: '/roadmap/p1' },
          ],
        },
      ],
    },

    // 将 docs 源文件重新编排为站点目录
    // 参见根配置 rewrites
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

  // 将扁平化的 docs/*.md 源文件映射到分组路径，避免大搬迁
  rewrites: {
    '01-getting-started.md': 'guide/getting-started.md',
    '02-architecture.md': 'guide/architecture.md',
    '03-configuration.md': 'guide/configuration.md',
    '04-core-api.md': 'core/core-api.md',
    '05-guards-and-decorators.md': 'core/guards-and-decorators.md',
    '06-storage.md': 'core/storage.md',
    '07-token-strategy.md': 'core/token-strategy.md',
    '08-exceptions.md': 'core/exceptions.md',
    '09-recipes.md': 'core/recipes.md',
    '10-roadmap-p1.md': 'roadmap/p1.md',
    '11-permissions-and-session.md': 'core/permissions-and-session.md',
    'SRC-REFERENCE.md': 'reference/src-reference.md',
    'archive/00-roadmap.md': 'reference/archive/roadmap.md',
    'archive/03-integration.md': 'reference/archive/integration.md',
    'archive/04-status.md': 'reference/archive/status.md',
    'archive/05-npm-package.md': 'reference/archive/npm-package.md',
  },
})
