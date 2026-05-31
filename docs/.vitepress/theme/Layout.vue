<script setup lang="ts">
import DefaultTheme from 'vitepress/theme';
import { useData } from 'vitepress';
import { computed } from 'vue';
import HomePage from './Home.vue';
import SupportProjectModal from './components/SupportProjectModal.vue';

const { Layout: DefaultLayout } = DefaultTheme
const { frontmatter, page } = useData()

const isHome = computed(
  () => frontmatter.value.layout === 'home' || page.value.relativePath === 'index.md',
)

const isDoc = computed(() => !isHome.value && frontmatter.value.layout !== false)
</script>

<template>
  <DefaultLayout>
    <template v-if="isHome" #home-hero-before>
      <HomePage />
    </template>
<!--    <template v-if="isDoc" #doc-top>-->
<!--      <DocHeader />-->
<!--    </template>-->
  </DefaultLayout>
  <SupportProjectModal />
</template>
