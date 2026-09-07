<script setup lang="ts">
import { computed } from "vue";
import { useData, useRoute, withBase } from "vitepress";

defineProps<{
  showTabs?: boolean;
}>();

const route = useRoute();
const { isDark, site } = useData();

const version = __XLT_VERSION__;

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
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.8-3.8" />
        </svg>
        <span>搜索文档</span>
        <kbd>⌘ K</kbd>
      </button>

      <div class="xlt-site-header__tools">
        <details class="xlt-site-header__version">
          <summary>v{{ version }}</summary>
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
          <svg v-if="isDark" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
          </svg>
        </button>

        <a
          class="xlt-site-header__icon-button"
          href="https://github.com/xiaoLangtou/xlt-token"
          target="_blank"
          rel="noreferrer"
          aria-label="GitHub"
        >
          <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
          </svg>
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
