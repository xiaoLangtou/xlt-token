<script setup lang="ts">
import { computed } from "vue";
import { useData, useRoute, withBase } from "vitepress";

defineProps<{
  showTabs?: boolean;
}>();

const route = useRoute();
const { isDark, site } = useData();

const navItems = [
  {
    text: "快速开始",
    link: "/guide/getting-started",
    match: ["/guide/"],
  },
  {
    text: "Core",
    link: "/core/getting-started",
    match: ["/core/"],
  },
  {
    text: "NestJS",
    link: "/adapters/nestjs/getting-started",
    match: ["/adapters/nestjs/"],
  },
  {
    text: "Express",
    link: "/adapters/express",
    match: ["/adapters/express"],
  },
  {
    text: "Fastify",
    link: "/adapters/fastify",
    match: ["/adapters/fastify"],
  },
  {
    text: "参考",
    link: "/reference/src-reference",
    match: ["/reference/src-reference"],
  },
  {
    text: "Release",
    link: "/reference/changelog",
    match: ["/reference/changelog"],
  },
];

const path = computed(() => route.path);

function isActive(matchers: string[]) {
  return matchers.some((matcher) => path.value.includes(matcher));
}

function openSearch() {
  document.querySelector<HTMLButtonElement>(".DocSearch-Button")?.click();
}

function toggleTheme() {
  document.querySelector<HTMLButtonElement>(".VPSwitchAppearance")?.click();
}
</script>

<template>
  <header class="xlt-site-header" :class="{ 'xlt-site-header--compact': !showTabs }">
    <div class="xlt-site-header__top">
      <a class="xlt-site-header__brand" :href="withBase('/')">
        <img
          class="xlt-site-header__logo"
          :src="withBase('/logo.png')"
          alt=""
          width="28"
          height="28"
        />
        <span>{{ site.title }}</span>
      </a>

      <button class="xlt-site-header__search" type="button" @click="openSearch">
        <span class="xlt-site-header__search-icon" aria-hidden="true" />
        <span>搜索文档</span>
        <kbd>⌘ K</kbd>
      </button>

      <div class="xlt-site-header__tools">
        <details class="xlt-site-header__version">
          <summary>v2.3.0</summary>
          <div class="xlt-site-header__version-menu">
            <a :href="withBase('/reference/changelog')">更新日志</a>
            <a
              href="https://github.com/xiaoLangtou/xlt-token/releases"
              target="_blank"
              rel="noreferrer"
              >GitHub Releases</a
            >
            <a href="https://www.npmjs.com/package/xlt-token" target="_blank" rel="noreferrer"
              >npm</a
            >
          </div>
        </details>

        <button
          class="xlt-site-header__icon-button"
          type="button"
          aria-label="切换主题"
          @click="toggleTheme"
        >
          <span class="xlt-site-header__theme-icon" aria-hidden="true">
            {{ isDark ? "☾" : "☼" }}
          </span>
        </button>

        <a
          class="xlt-site-header__icon-button"
          href="https://github.com/xiaoLangtou/xlt-token"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
        >
          <span class="xlt-site-header__github" aria-hidden="true" />
        </a>
      </div>
    </div>

    <nav v-if="showTabs" class="xlt-site-header__tabs" aria-label="文档分区">
      <a
        v-for="item in navItems"
        :key="item.link"
        class="xlt-site-header__tab"
        :class="{ 'is-active': isActive(item.match) }"
        :href="withBase(item.link)"
      >
        {{ item.text }}
      </a>
    </nav>
  </header>
</template>
