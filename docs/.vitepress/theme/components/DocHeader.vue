<script setup lang="ts">
import { computed } from 'vue'
import { useData, withBase } from 'vitepress'

const { page } = useData()

const sections: Record<string, { label: string; href: string }> = {
  guide: { label: '指南', href: '/guide/getting-started' },
  core: { label: '核心', href: '/core/core-api' },
  reference: { label: '参考', href: '/reference/src-reference' },
  roadmap: { label: '路线图', href: '/roadmap/1-1-0' },
}

const sectionKey = computed(() => page.value.relativePath.split('/')[0] ?? '')
const section = computed(() => sections[sectionKey.value])

const pageTitle = computed(() => page.value.title.replace(/^\d+\s*·\s*/, ''))
</script>

<template>
  <div v-if="section" class="xlt-doc-top">
    <nav class="xlt-doc-top__crumbs" aria-label="面包屑">
      <a :href="withBase('/')">文档</a>
      <span aria-hidden="true">/</span>
      <a :href="withBase(section.href)">{{ section.label }}</a>
      <span aria-hidden="true">/</span>
      <span class="xlt-doc-top__current">{{ pageTitle }}</span>
    </nav>
    <span class="xlt-doc-top__tag">{{ section.label }}</span>
  </div>
</template>
