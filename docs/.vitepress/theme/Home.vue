<script setup lang="ts">
import { ref } from 'vue';
import { withBase } from 'vitepress';

const copied = ref(false)

async function copyInstall() {
  try {
    await navigator.clipboard.writeText('pnpm add xlt-token')
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
  catch { /* ignore */ }
}

const guides = [
  { title: '快速开始', desc: '5 分钟接入 NestJS', link: '/guide/getting-started' },
  { title: '架构设计', desc: '分层与存储键结构', link: '/guide/architecture' },
  { title: '配置参考', desc: 'XltTokenConfig 全字段', link: '/guide/configuration' },
]

const core = [
  { title: '核心 API', link: '/core/core-api' },
  { title: '守卫与装饰器', link: '/core/guards-and-decorators' },
  { title: '权限与会话', link: '/core/permissions-and-session' },
  { title: '存储层', link: '/core/storage' },
  { title: 'Token 策略', link: '/core/token-strategy' },
  { title: '异常处理', link: '/core/exceptions' },
]

const v110 = [
  { title: '多端登录', link: '/core/multi-device' },
  { title: '二级认证', link: '/core/secondary-auth' },
  { title: 'JWT 策略', link: '/core/jwt-strategy' },
  { title: 'Hooks 与观测', link: '/core/hooks-and-observability' },
  { title: '场景手册', link: '/core/recipes' },
  { title: '源码参考', link: '/reference/src-reference' },
]

const features = [
  { n: '01', title: '开箱即用', desc: 'forRoot 一行注册，默认配置跑通登录、鉴权、踢人与登出。' },
  { n: '02', title: '可插拔架构', desc: 'Store、Token 策略、守卫均可替换，适配 Redis / 内存。' },
  { n: '03', title: 'Sa-Token 语义', desc: '顶号、踢人、活跃过期、多端并发等能力原生支持。' },
  { n: '04', title: '守卫 + 装饰器', desc: '@LoginId / @XltCheckPermission 声明式开发体验。' },
  { n: '05', title: '1.1.0 新能力', desc: '多端 device、二级认证、JWT 黑名单、Hooks 与在线观测。', wide: true },
]

const navGroups = [
  { badge: 'Guide', title: '入门', items: guides },
  { badge: 'Core', title: '核心', items: core },
  { badge: 'v1.1', title: '1.1.0', items: v110 },
]

const stats = [
  { value: '274', label: '测试用例' },
  { value: '96%+', label: '覆盖率' },
  { value: 'MIT', label: '开源协议' },
]
</script>

<template>
  <div class="xlt-home">
    <section class="xlt-hero">
      <div class="xlt-hero__bg" aria-hidden="true">
        <div class="xlt-hero__mesh" />
        <div class="xlt-orb xlt-orb--1" />
        <div class="xlt-orb xlt-orb--2" />
        <div class="xlt-orb xlt-orb--3" />
        <div class="xlt-hero__grid" />
        <div class="xlt-hero__scan" />
      </div>

      <div class="xlt-hero__inner">
        <div class="xlt-hero__copy">
          <div class="xlt-hero__badge xlt-anim xlt-anim--1">
            <span class="xlt-hero__pulse" />
            v1.0.0-rc.1 · NestJS
          </div>

          <h1 class="xlt-hero__title xlt-anim xlt-anim--2">
            <span class="xlt-hero__title-gradient">xlt-token</span>
          </h1>

          <p class="xlt-hero__lede xlt-anim xlt-anim--3">
            为 NestJS 打造的轻量 Token 鉴权库。可插拔 Store 与策略、全局 Guard 一行接入。
          </p>

          <div class="xlt-hero__install xlt-anim xlt-anim--4">
            <button type="button" class="xlt-install" @click="copyInstall">
              <span class="xlt-install__prompt">$</span>
              <code>pnpm add xlt-token</code>
              <span class="xlt-install__copy">{{ copied ? '已复制 ✓' : '复制' }}</span>
            </button>
          </div>

          <div class="xlt-hero__actions xlt-anim xlt-anim--5">
            <a class="xlt-btn xlt-btn--glow" :href="withBase('/guide/getting-started')">
              快速开始
              <span class="xlt-btn__arrow">→</span>
            </a>
            <a class="xlt-btn xlt-btn--glass" :href="withBase('/core/core-api')">核心 API</a>
            <a class="xlt-btn xlt-btn--glass" href="https://github.com/xiaoLangtou/xlt-token" target="_blank" rel="noreferrer">GitHub</a>
          </div>

          <dl class="xlt-hero__stats xlt-anim xlt-anim--6">
            <div v-for="s in stats" :key="s.label">
              <dt>{{ s.value }}</dt>
              <dd>{{ s.label }}</dd>
            </div>
          </dl>
        </div>

        <div class="xlt-preview  xlt-anim--4 xlt-preview--float">
          <div class="xlt-preview__glow" aria-hidden="true" />
          <div class="xlt-preview__bar">
            <span /><span /><span />
            <span class="xlt-preview__name">app.module.ts</span>
            <span class="xlt-preview__tag">Live</span>
          </div>
          <pre class="xlt-preview__code"><code><span class="c-k">import</span> { Module } <span class="c-k">from</span> <span class="c-s">'@nestjs/common'</span>
<span class="c-k">import</span> { XltTokenModule } <span class="c-k">from</span> <span class="c-s">'xlt-token'</span>

@Module({
  imports: [
    XltTokenModule.forRoot({
      isGlobal: <span class="c-b">true</span>,
      config: { timeout: <span class="c-n">86400</span> },
    }),
  ],
})
<span class="c-k">export class</span> <span class="c-t">AppModule</span> {}</code></pre>
        </div>
      </div>
    </section>

    <section class="xlt-block xlt-block--caps">
      <header class="xlt-block__head xlt-reveal">
        <p class="xlt-kicker">Capabilities</p>
        <h2>核心能力</h2>
        <p>专注鉴权场景，减少重复造轮子</p>
      </header>
      <div class="xlt-cards">
        <article
          v-for="(f, i) in features"
          :key="f.title"
          class="xlt-card xlt-reveal"
          :class="{ 'xlt-card--wide': f.wide }"
          :style="{ '--delay': `${i * 0.07}s` }"
        >
          <span class="xlt-card__accent" aria-hidden="true" />
          <span class="xlt-card__watermark" aria-hidden="true">{{ f.n }}</span>
          <div class="xlt-card__body">
            <div class="xlt-card__top">
              <span class="xlt-card__n">{{ f.n }}</span>
              <span class="xlt-card__line" aria-hidden="true" />
            </div>
            <h3>{{ f.title }}</h3>
            <p>{{ f.desc }}</p>
          </div>
          <span class="xlt-card__shine" aria-hidden="true" />
        </article>
      </div>
    </section>

    <section class="xlt-block xlt-block--docs">
      <header class="xlt-block__head xlt-reveal">
        <p class="xlt-kicker">Documentation</p>
        <h2>文档导航</h2>
        <p>按模块查阅，侧边栏提供完整目录</p>
      </header>
      <div class="xlt-nav-grid">
        <article
          v-for="(group, i) in navGroups"
          :key="group.title"
          class="xlt-doc-card xlt-reveal"
          :style="{ '--delay': `${i * 0.08}s` }"
        >
          <span class="xlt-doc-card__glow" aria-hidden="true" />
          <header class="xlt-doc-card__head">
            <span class="xlt-doc-card__badge">{{ group.badge }}</span>
            <h3>{{ group.title }}</h3>
          </header>
          <ul class="xlt-doc-card__list">
            <li v-for="item in group.items" :key="item.link">
              <a class="xlt-doc-link" :href="withBase(item.link)">
                <span class="xlt-doc-link__icon" aria-hidden="true" />
                <span class="xlt-doc-link__text">
                  <strong>{{ item.title }}</strong>
                  <small v-if="'desc' in item && item.desc">{{ item.desc }}</small>
                </span>
                <span class="xlt-doc-link__arrow" aria-hidden="true">→</span>
              </a>
            </li>
          </ul>
        </article>
      </div>
    </section>

    <section class="xlt-block">
      <div class="xlt-cta xlt-reveal">
        <div class="xlt-cta__glow" aria-hidden="true" />
        <div>
          <p class="xlt-kicker">Community</p>
          <h2>加入社区</h2>
          <p>扫码加入交流群，获取更新通知与用法答疑。</p>
        </div>
        <img :src="withBase('/img.png')" alt="交流群二维码" width="112" height="112" loading="lazy" />
      </div>
    </section>
  </div>
</template>
