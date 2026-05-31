<script setup lang="ts">
import { onMounted, ref } from 'vue'

const STORAGE_KEY = 'xlt-token-support-modal-dismissed'
const HIDE_DURATION = 7 * 24 * 60 * 60 * 1000
const GITEE_URL = 'https://gitee.com/wei_pengcheng_admin/xlt-token'

const repoLinks = [
  { label: 'GitHub', platform: 'github', url: 'https://github.com/xiaoLangtou/xlt-token', short: 'github.com/xiaoLangtou/xlt-token' },
  { label: 'Gitee', platform: 'gitee', url: 'https://gitee.com/wei_pengcheng_admin/xlt-token', short: 'gitee.com/wei_pengcheng_admin/xlt-token' },
  { label: 'GitCode', platform: 'gitcode', url: 'https://gitcode.com/weipc/xlt-token', short: 'gitcode.com/weipc/xlt-token' },
]

const visible = ref(false)

function shouldShow(): boolean {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw)
    return true
  const dismissedAt = Number(raw)
  if (Number.isNaN(dismissedAt))
    return true
  return Date.now() - dismissedAt > HIDE_DURATION
}

function close() {
  visible.value = false
}

function onConfirm() {
  localStorage.setItem(STORAGE_KEY, String(Date.now()))
  close()
  window.open(GITEE_URL, '_blank', 'noopener,noreferrer')
}

onMounted(() => {
  if (shouldShow()) {
    window.setTimeout(() => {
      visible.value = true
    }, 600)
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="xlt-support-fade">
      <div
        v-if="visible"
        class="xlt-support-overlay"
        role="presentation"
        @click.self="close"
      >
        <div
          class="xlt-support-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="xlt-support-title"
        >
          <!-- 顶部彩虹光条 -->
          <div class="xlt-support-modal__bar" aria-hidden="true" />

          <header class="xlt-support-modal__header">
            <h2 id="xlt-support-title" class="xlt-support-modal__title">
              <span class="xlt-support-modal__title-icon" aria-hidden="true">⭐</span>
              支持项目
            </h2>
            <button
              type="button"
              class="xlt-support-modal__close"
              aria-label="关闭"
              @click="close"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M18.3 5.71a1 1 0 0 0-1.41 0L12 10.59 7.11 5.7A1 1 0 0 0 5.7 7.11L10.59 12l-4.9 4.89a1 1 0 1 0 1.41 1.42L12 13.41l4.89 4.89a1 1 0 0 0 1.41-1.42L13.41 12l4.89-4.89a1 1 0 0 0 0-1.4Z"
                />
              </svg>
            </button>
          </header>

          <div class="xlt-support-modal__body">
            <!-- GitHub 仓库卡片预览 -->
            <div class="xlt-support-modal__preview" aria-hidden="true">
              <div class="xlt-ghcard">
                <div class="xlt-ghcard__scan" />
                <div class="xlt-ghcard__head">
                  <div class="xlt-ghcard__repo">
                    <span class="xlt-ghcard__avatar" />
                    <span class="xlt-ghcard__owner">xiaoLangtou</span>
                    <span class="xlt-ghcard__slash">/</span>
                    <span class="xlt-ghcard__name">xlt-token</span>
                    <span class="xlt-ghcard__public">Public</span>
                  </div>
                </div>

                <div class="xlt-ghcard__main">
                  <div class="xlt-ghcard__info">
                    <div class="xlt-ghcard__title">
                      xlt-token
                    </div>
                    <div class="xlt-ghcard__desc">
                      Design token system · MIT License
                    </div>
                  </div>
                  <div class="xlt-ghcard__star">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor" aria-hidden="true">
                      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.873 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
                    </svg>
                    <span>Star</span>
                    <span class="xlt-ghcard__star-count">128</span>
                  </div>
                </div>

                <div class="xlt-ghcard__meta">
                  <span class="xlt-ghcard__stat">
                    <span class="xlt-ghcard__lang-dot" />
                    TypeScript
                  </span>
                  <span class="xlt-ghcard__stat">
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
                      <path d="M5 5.372v.878c0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75v-.878a2.25 2.25 0 1 0-4.5 0Zm-2.5-.628a2.25 2.25 0 1 1 3 2.122v.878A2.25 2.25 0 0 1 8.25 9.999H7.75a2.25 2.25 0 0 1-2.25-2.255v-.878a2.25 2.25 0 0 1-3-2.122ZM8 13.5a2.25 2.25 0 1 1 0-4.5 2.25 2.25 0 0 1 0 4.5Z" />
                    </svg>
                    32 forks
                  </span>
                  <span class="xlt-ghcard__stat">
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
                      <path d="M8 2c1.981 0 3.671.992 4.933 2.078 1.27 1.091 2.187 2.345 2.637 3.023a1.62 1.62 0 0 1 0 1.798c-.45.678-1.367 1.932-2.637 3.023C11.67 13.008 9.981 14 8 14c-1.981 0-3.671-.992-4.933-2.078C1.797 10.831.88 9.577.43 8.9a1.62 1.62 0 0 1 0-1.798c.45-.678 1.367-1.932 2.637-3.023C4.33 2.992 6.019 2 8 2Zm0 1.5c-1.498 0-2.866.755-3.959 1.694-.94.808-1.747 1.91-2.165 2.531a.12.12 0 0 0 0 .15c.418.62 1.225 1.722 2.165 2.531C5.134 11.745 6.502 12.5 8 12.5c1.498 0 2.866-.755 3.959-1.694.94-.808 1.747-1.91 2.165-2.531a.12.12 0 0 0 0-.15c-.418-.62-1.225-1.722-2.165-2.531C10.866 4.255 9.498 3.5 8 3.5ZM8 6a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" />
                    </svg>
                    12 watching
                  </span>
                  <span class="xlt-ghcard__hint">点击 Star 支持项目</span>
                </div>
              </div>
            </div>

            <p class="xlt-support-modal__highlight">
              <span class="xlt-support-modal__highlight-icon" aria-hidden="true">✦</span>
              xlt-token 采用 MIT 开源协议，框架本身与在线文档永久免费开放。
            </p>
            <p class="xlt-support-modal__text">
              如果 xlt-token 帮助到了你，希望你可以为项目点个 Star ⭐，这对我们非常重要，感谢你的支持！
            </p>

            <!-- 链接列表 -->
            <p class="xlt-support-modal__links-label">
              仓库地址
            </p>
            <ul class="xlt-support-modal__links">
              <li v-for="item in repoLinks" :key="item.label">
                <a
                  :href="item.url"
                  class="xlt-support-modal__link-row"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span
                    class="xlt-support-modal__link-platform"
                    :class="`xlt-support-modal__link-platform--${item.platform}`"
                  >{{ item.label }}</span>
                  <span class="xlt-support-modal__link-url">{{ item.short }}</span>
                  <svg class="xlt-support-modal__link-arrow" viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                  </svg>
                </a>
              </li>
            </ul>
          </div>

          <footer class="xlt-support-modal__footer">
            <button type="button" class="xlt-support-modal__later" @click="close">
              稍后再说
            </button>
            <button type="button" class="xlt-support-modal__confirm" @click="onConfirm">
              <span>前往 Star</span>
              <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor" aria-hidden="true">
                <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.751.751 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.873 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
              </svg>
            </button>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
