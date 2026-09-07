<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { withBase } from "vitepress";

const version = __XLT_VERSION__;
const copied = ref(false);

async function copyInstall() {
  try {
    await navigator.clipboard.writeText("pnpm add @xlt-token/core");
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    /* ignore */
  }
}

/* ── Terminal TTL countdown ── */
const TOKEN_TTL = 604800;
const SESSION_TTL = 1800;

const tokenTtl = ref(TOKEN_TTL);
const sessionTtl = ref(SESSION_TTL);

let timer: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  timer = setInterval(() => {
    tokenTtl.value = tokenTtl.value > 0 ? tokenTtl.value - 1 : TOKEN_TTL;
    sessionTtl.value = sessionTtl.value > 0 ? sessionTtl.value - 1 : SESSION_TTL;
  }, 1000);
});

onBeforeUnmount(() => {
  if (timer) clearInterval(timer);
});

const keys = computed(() => [
  {
    name: "xlt:login:token:9f3a…c21e",
    remaining: tokenTtl.value,
    pct: (tokenTtl.value / TOKEN_TTL) * 100,
  },
  {
    name: "xlt:login:session:1001",
    remaining: sessionTtl.value,
    pct: (sessionTtl.value / SESSION_TTL) * 100,
  },
]);

const guides = [
  {
    title: "选择接入方式",
    desc: "Core、NestJS、Express 或 Fastify",
    link: "/guide/getting-started",
  },
  { title: "Redis Store", desc: "node-redis 与 ioredis 完整指南", link: "/store-redis/" },
  { title: "架构设计", desc: "分层与存储键结构", link: "/guide/architecture" },
];

const core = [
  { title: "Core 独立使用", link: "/core/getting-started" },
  { title: "核心 API", link: "/core/core-api" },
  { title: "权限与会话", link: "/core/permissions-and-session" },
  { title: "Store 契约与内存存储", link: "/core/storage" },
  { title: "Token 策略", link: "/core/token-strategy" },
  { title: "异常处理", link: "/core/exceptions" },
];

const advanced = [
  { title: "多端登录", link: "/core/multi-device" },
  { title: "二级认证", link: "/core/secondary-auth" },
  { title: "JWT 策略", link: "/core/jwt-strategy" },
  { title: "Hooks 与观测", link: "/core/hooks-and-observability" },
  { title: "场景手册", link: "/core/recipes" },
  { title: "源码参考", link: "/reference/src-reference" },
];

const features = [
  {
    tag: "@xlt-token/core",
    title: "开箱即用",
    desc: "Core 零框架依赖，默认配置即可跑通登录、鉴权、踢人与登出。",
  },
  {
    tag: "@xlt-token/store-redis",
    title: "分布式存储",
    desc: "Redis Store 独立安装，键结构自带 TTL，node-redis 与 ioredis 双客户端。",
  },
  {
    tag: "sa-token 语义",
    title: "会话控制",
    desc: "顶号、踢人、活跃过期、多端并发等能力原生支持。",
  },
  {
    tag: "nestjs / express / fastify",
    title: "多框架接入",
    desc: "NestJS 提供 Guard 与装饰器；Express 与 Fastify 提供路由策略适配。",
  },
  {
    tag: `v${version}`,
    title: "2.x 生命周期能力",
    desc: "多端 device、二级认证、JWT 密钥轮换、刷新重放检测、审计事件与在线观测。",
    wide: true,
  },
];

const navGroups = [
  { badge: "Start", title: "快速开始", items: guides },
  { badge: "Core", title: "核心能力", items: core },
  { badge: "More", title: "进阶与参考", items: advanced },
];

const stats = [
  { value: "274", label: "测试用例" },
  { value: "96%+", label: "覆盖率" },
  { value: "MIT", label: "开源协议" },
];
</script>

<template>
  <div class="xlt-home">
    <section class="xlt-hero">
      <div class="xlt-hero__inner">
        <div class="xlt-hero__copy">
          <p class="xlt-hero__badge xlt-anim xlt-anim--1">
            <span class="xlt-hero__dot" aria-hidden="true" />
            v{{ version }} · core + redis + adapters
          </p>

          <h1 class="xlt-hero__title xlt-anim xlt-anim--2">xlt-token</h1>

          <p class="xlt-hero__lede xlt-anim xlt-anim--3">
            框架无关的 Token 鉴权核心，配套独立 Redis Store、NestJS 与 Express 适配器。
          </p>

          <div class="xlt-hero__install xlt-anim xlt-anim--4">
            <button type="button" class="xlt-install" @click="copyInstall">
              <span class="xlt-install__prompt">$</span>
              <code>pnpm add @xlt-token/core</code>
              <span class="xlt-install__copy">{{ copied ? "已复制" : "复制" }}</span>
            </button>
          </div>

          <div class="xlt-hero__actions xlt-anim xlt-anim--5">
            <a class="xlt-btn xlt-btn--primary" :href="withBase('/guide/getting-started')">
              快速开始
              <span class="xlt-btn__arrow" aria-hidden="true">→</span>
            </a>
            <a class="xlt-btn xlt-btn--ghost" :href="withBase('/store-redis/')">Redis Store</a>
            <a
              class="xlt-btn xlt-btn--ghost"
              href="https://github.com/xiaoLangtou/xlt-token"
              target="_blank"
              rel="noreferrer"
              >GitHub</a
            >
          </div>

          <dl class="xlt-hero__stats xlt-anim xlt-anim--6">
            <div v-for="s in stats" :key="s.label">
              <dt>{{ s.value }}</dt>
              <dd>{{ s.label }}</dd>
            </div>
          </dl>
        </div>

        <div class="xlt-term xlt-anim xlt-anim--4" role="img" aria-label="redis-cli 演示：签发带 TTL 的登录 token 并查询剩余时间">
          <div class="xlt-term__bar">
            <span /><span /><span />
            <span class="xlt-term__title">redis-cli — keyspace</span>
            <span class="xlt-term__tag">TTL</span>
          </div>
          <div class="xlt-term__body">
            <p class="xlt-term__line">
              <span class="xlt-term__prompt">127.0.0.1:6379&gt;</span> SET
              <span class="xlt-term__key">xlt:login:token:9f3a…c21e</span>
              <span class="xlt-term__str">"1001"</span> EX 604800
            </p>
            <p class="xlt-term__line xlt-term__ok">OK</p>
            <p class="xlt-term__line">
              <span class="xlt-term__prompt">127.0.0.1:6379&gt;</span> TTL
              <span class="xlt-term__key">xlt:login:token:9f3a…c21e</span>
            </p>
            <p class="xlt-term__line">
              (integer) <span class="xlt-term__num">{{ tokenTtl.toLocaleString() }}</span>
            </p>
            <p class="xlt-term__line">
              <span class="xlt-term__prompt">127.0.0.1:6379&gt;</span>
              <span class="xlt-term__caret" aria-hidden="true" />
            </p>
          </div>
          <div class="xlt-term__keys">
            <p class="xlt-term__keys-title">Keyspace</p>
            <div v-for="k in keys" :key="k.name" class="xlt-key">
              <div class="xlt-key__meta">
                <span class="xlt-key__name">{{ k.name }}</span>
                <span class="xlt-key__ttl">{{ k.remaining.toLocaleString() }}s</span>
              </div>
              <div class="xlt-key__bar">
                <span :style="{ width: `${k.pct}%` }" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="xlt-block">
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
          <div class="xlt-card__top">
            <span class="xlt-card__tag">{{ f.tag }}</span>
            <span class="xlt-card__line" aria-hidden="true" />
          </div>
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
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
        <div>
          <p class="xlt-kicker">Community</p>
          <h2>加入社区</h2>
          <p>扫码加入交流群，获取更新通知与用法答疑。</p>
        </div>
        <img
          :src="withBase('/img.png')"
          alt="交流群二维码"
          width="300"
          height="300"
          loading="lazy"
        />
      </div>
    </section>
  </div>
</template>
