<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { useData } from 'vitepress';
import { computed } from 'vue';
import HomePage from './Home.vue';
import SupportProjectModal from './components/SupportProjectModal.vue';
import SiteHeader from './components/SiteHeader.vue';
import CopyPage from './components/CopyPage.vue';

const { Layout: DefaultLayout } = DefaultTheme
const { frontmatter, page } = useData()

const isHome = computed(
  () => frontmatter.value.layout === 'home' || page.value.relativePath === 'index.md',
)

const hasHeader = computed(() => frontmatter.value.layout !== false)
</script>

<template>
  <SiteHeader v-if="hasHeader" :show-tabs="!isHome" />
  <DefaultLayout>
    <template v-if="isHome" #home-hero-before>
      <HomePage />
    </template>
    <template #doc-before>
      <CopyPage />
    </template>
<!--    <template v-if="isDoc" #doc-top>-->
<!--      <DocHeader />-->
<!--    </template>-->
  </DefaultLayout>
  <SupportProjectModal v-if="isHome" />
</template>
