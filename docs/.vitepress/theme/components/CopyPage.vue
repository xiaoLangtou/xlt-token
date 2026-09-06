<script setup lang="ts">
import { computed, ref } from "vue";
import { useData, useRoute } from "vitepress";

const { page, frontmatter, site } = useData();
const route = useRoute();

const copied = ref("");

const isDoc = computed(
  () =>
    frontmatter.value.layout !== "home" &&
    frontmatter.value.layout !== false &&
    page.value.relativePath !== "index.md",
);

const normalizedRoute = computed(() => {
  const base = site.value.base.replace(/\/$/, "");
  let value = route.path.replace(/\.html$/, "").replace(/\/$/, "");
  if (base && value.startsWith(base)) value = value.slice(base.length) || "/";
  return value || "/";
});

const sourcePath = computed(() => page.value.relativePath);
const githubRawHref = computed(
  () =>
    `https://raw.githubusercontent.com/xiaoLangtou/xlt-token/refs/heads/master/docs/${sourcePath.value}`,
);

const fileName = computed(() => {
  const name = normalizedRoute.value.split("/").filter(Boolean).join("-");
  return `${name || "index"}.md`;
});

async function copyText(text: string, label: string) {
  await navigator.clipboard.writeText(text);
  copied.value = label;
  window.setTimeout(() => {
    if (copied.value === label) copied.value = "";
  }, 1400);
}

async function getMarkdown() {
  const response = await fetch(githubRawHref.value);
  if (!response.ok) throw new Error(`Failed to load markdown: ${githubRawHref.value}`);
  return response.text();
}

async function copyMarkdown() {
  try {
    await copyText(await getMarkdown(), "copy");
  } catch {
    // silently fail
  }
}

async function downloadMarkdown() {
  try {
    const markdown = await getMarkdown();
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName.value;
    anchor.click();
    URL.revokeObjectURL(url);
    copied.value = "download";
  } catch {
    copied.value = "error";
  }
  window.setTimeout(() => {
    if (copied.value === "download" || copied.value === "error") copied.value = "";
  }, 1400);
}
</script>

<template>
  <div v-if="isDoc" class="xlt-copy-page">
    <div class="xlt-copy-page__actions" aria-label="Markdown page actions">
      <button class="xlt-copy-page__action" type="button" @click="copyMarkdown">
        <svg class="xlt-copy-page__icon" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="8" y="8" width="12" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
        </svg>
        <span>{{ copied === "copy" ? "Copied Markdown" : "Copy as Markdown" }}</span>
      </button>
      <button class="xlt-copy-page__action" type="button" @click="downloadMarkdown">
        <svg class="xlt-copy-page__icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3v12" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 21h14" />
        </svg>
        <span>{{
          copied === "download"
            ? "Downloaded"
            : copied === "error"
              ? "Download failed"
              : "Download as Markdown"
        }}</span>
      </button>
    </div>
  </div>
</template>
