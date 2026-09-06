<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import releaseCodeHtml from "virtual:xlt-release-code-html";
import v230 from "../../../../.github/releases/v2.3.0.md?raw";
import v220 from "../../../../.github/releases/v2.2.0.md?raw";
import v210 from "../../../../.github/releases/v2.1.0.md?raw";
import v121 from "../../../../.github/releases/v1.2.1.md?raw";
import v120 from "../../../../.github/releases/v1.2.0.md?raw";
import v110 from "../../../../.github/releases/v1.1.0.md?raw";
import v100 from "../../../../.github/releases/v1.0.0.md?raw";
import v102 from "../../../../.github/releases/v1.0.2.md?raw";
import rc1 from "../../../../.github/releases/v1.0.0-rc.1.md?raw";
import rc2 from "../../../../.github/releases/v1.0.0-rc.2.md?raw";
import rc3 from "../../../../.github/releases/v1.0.0-rc.3.md?raw";

type Block =
  | { type: "subheading"; text: string }
  | { type: "paragraph"; html: string }
  | { type: "list"; items: string[] }
  | { type: "code"; lang: string; code: string; closed?: boolean }
  | { type: "table"; headers: string[]; rows: string[][] };

interface Section {
  title: string;
  blocks: Block[];
}

interface Release {
  version: string;
  date: string;
  summary: string;
  sections: Section[];
  source: string;
  compare?: string;
}

interface ReleaseFile {
  date: string;
  source: string;
  url: string;
  fallbackRaw: string;
}

const RELEASE_FILES: ReleaseFile[] = [
  {
    date: "Sep 5, 2026",
    source: "v2.3.0.md",
    url: "https://raw.githubusercontent.com/xiaoLangtou/xlt-token/master/.github/releases/v2.3.0.md",
    fallbackRaw: v230,
  },
  {
    date: "Aug 20, 2026",
    source: "v2.2.0.md",
    url: "https://raw.githubusercontent.com/xiaoLangtou/xlt-token/master/.github/releases/v2.2.0.md",
    fallbackRaw: v220,
  },
  {
    date: "Aug 3, 2026",
    source: "v2.1.0.md",
    url: "https://raw.githubusercontent.com/xiaoLangtou/xlt-token/master/.github/releases/v2.1.0.md",
    fallbackRaw: v210,
  },
  {
    date: "Jun 15, 2026",
    source: "v1.2.1.md",
    url: "https://raw.githubusercontent.com/xiaoLangtou/xlt-token/master/.github/releases/v1.2.1.md",
    fallbackRaw: v121,
  },
  {
    date: "Jun 14, 2026",
    source: "v1.2.0.md",
    url: "https://raw.githubusercontent.com/xiaoLangtou/xlt-token/master/.github/releases/v1.2.0.md",
    fallbackRaw: v120,
  },
  {
    date: "Jun 11, 2026",
    source: "v1.1.0.md",
    url: "https://raw.githubusercontent.com/xiaoLangtou/xlt-token/master/.github/releases/v1.1.0.md",
    fallbackRaw: v110,
  },
  {
    date: "Jun 8, 2026",
    source: "v1.0.2.md",
    url: "https://raw.githubusercontent.com/xiaoLangtou/xlt-token/master/.github/releases/v1.0.2.md",
    fallbackRaw: v102,
  },
  {
    date: "Jun 6, 2026",
    source: "v1.0.0.md",
    url: "https://raw.githubusercontent.com/xiaoLangtou/xlt-token/master/.github/releases/v1.0.0.md",
    fallbackRaw: v100,
  },
  {
    date: "May 29, 2026",
    source: "v1.0.0-rc.3.md",
    url: "https://raw.githubusercontent.com/xiaoLangtou/xlt-token/master/.github/releases/v1.0.0-rc.3.md",
    fallbackRaw: rc3,
  },
  {
    date: "May 26, 2026",
    source: "v1.0.0-rc.2.md",
    url: "https://raw.githubusercontent.com/xiaoLangtou/xlt-token/master/.github/releases/v1.0.0-rc.2.md",
    fallbackRaw: rc2,
  },
  {
    date: "Apr 26, 2026",
    source: "v1.0.0-rc.1.md",
    url: "https://raw.githubusercontent.com/xiaoLangtou/xlt-token/master/.github/releases/v1.0.0-rc.1.md",
    fallbackRaw: rc1,
  },
];

const releases = ref(parseReleaseFiles(RELEASE_FILES.map((file) => file.fallbackRaw)));
const sourceState = ref<"static" | "loading" | "remote" | "fallback">("static");

const sourceLabel = computed(() => {
  if (sourceState.value === "loading") return "正在同步 GitHub release";
  if (sourceState.value === "remote") return "已同步 GitHub release";
  if (sourceState.value === "fallback") return "使用本地 release 快照";
  return "本地 release 快照";
});

const latestRelease = computed(() => releases.value[0]);

onMounted(() => {
  void loadRemoteReleases();
});

async function loadRemoteReleases() {
  sourceState.value = "loading";

  try {
    const remoteRaw = await Promise.all(
      RELEASE_FILES.map(async (file) => {
        const response = await fetch(file.url);

        if (!response.ok) {
          throw new Error(`Failed to fetch ${file.source}: ${response.status}`);
        }

        return response.text();
      }),
    );

    releases.value = parseReleaseFiles(remoteRaw);
    sourceState.value = "remote";
  } catch {
    releases.value = parseReleaseFiles(RELEASE_FILES.map((file) => file.fallbackRaw));
    sourceState.value = "fallback";
  }
}

function parseReleaseFiles(rawFiles: string[]) {
  return rawFiles.map((raw, index) => {
    const file = RELEASE_FILES[index];

    return parseRelease(raw, {
      date: file.date,
      source: file.source,
    });
  });
}

function parseRelease(raw: string, meta: Pick<Release, "date" | "source">): Release {
  const lines = raw.split(/\r?\n/);
  const title = lines.find((line) => line.startsWith("# ")) ?? "";
  const version = title.match(/`([^`]+)`/)?.[1] ?? title.replace(/^#\s+Release\s+/, "").trim();
  const summary =
    lines
      .find((line) => line.startsWith("> "))
      ?.replace(/^>\s*/, "")
      .trim() ?? "";
  const compare = raw.match(/\*\*Full Changelog\*\*:\s*(https?:\/\/\S+)/)?.[1];

  const sections: Section[] = [];
  let current: Section | undefined;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      current = { title: line.replace(/^##\s+/, "").trim(), blocks: [] };
      sections.push(current);
      continue;
    }

    if (current) {
      appendLine(current, line);
    }
  }

  return {
    version,
    date: meta.date,
    summary,
    sections,
    source: meta.source,
    compare,
  };
}

function appendLine(section: Section, line: string) {
  const trimmed = line.trim();

  if (!trimmed || trimmed === "---" || trimmed.startsWith("**Full Changelog**")) {
    return;
  }

  const last = section.blocks.at(-1);

  if (trimmed.startsWith("```")) {
    const lang = trimmed.replace(/^```/, "").trim();
    if (last?.type === "code" && !last.closed) {
      last.closed = true;
      return;
    }
    section.blocks.push({ type: "code", lang, code: "" });
    return;
  }

  if (last?.type === "code" && !last.closed) {
    last.code += `${line}\n`;
    return;
  }

  if (trimmed.startsWith("### ")) {
    section.blocks.push({ type: "subheading", text: trimmed.replace(/^###\s+/, "") });
    return;
  }

  if (trimmed.startsWith("|")) {
    const tableLines = section.blocks.at(-1);
    const cells = splitTableRow(trimmed);
    if (trimmed.includes("---")) {
      return;
    }
    if (tableLines?.type === "table") {
      tableLines.rows.push(cells);
    } else {
      section.blocks.push({ type: "table", headers: cells, rows: [] });
    }
    return;
  }

  if (trimmed.startsWith("- ")) {
    const item = inlineMarkdown(trimmed.replace(/^-\s+/, ""));
    if (last?.type === "list") {
      last.items.push(item);
    } else {
      section.blocks.push({ type: "list", items: [item] });
    }
    return;
  }

  section.blocks.push({ type: "paragraph", html: inlineMarkdown(trimmed) });
}

function splitTableRow(row: string) {
  return row
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => inlineMarkdown(cell.trim()));
}

function inlineMarkdown(value: string) {
  return escapeHtml(value)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer">$1</a>',
    );
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function codeBlockKey(version: string, sectionIndex: number, blockIndex: number) {
  return `${version}:${sectionIndex}:${blockIndex}`;
}

function codeBlockHtml(
  block: Extract<Block, { type: "code" }>,
  version: string,
  sectionIndex: number,
  blockIndex: number,
) {
  return (
    releaseCodeHtml[codeBlockKey(version, sectionIndex, blockIndex)] ?? fallbackCodeHtml(block)
  );
}

function fallbackCodeHtml(block: Extract<Block, { type: "code" }>) {
  const langClass = block.lang ? ` class="language-${escapeHtml(block.lang)}"` : "";

  return `<pre><code${langClass}>${escapeHtml(block.code.trim())}</code></pre>`;
}

function sectionClass(title: string) {
  if (title.includes("Highlights")) return "is-highlight";
  if (title.includes("Breaking")) return "is-breaking";
  if (title.includes("Bug")) return "is-fix";
  if (title.includes("Features")) return "is-feature";
  if (title.includes("Quality")) return "is-quality";
  return "";
}
</script>

<template>
  <div class="xlt-changelog">
    <header class="xlt-changelog__header">
      <div class="xlt-changelog__title">
        <span class="xlt-changelog__eyebrow">Release notes</span>
        <h3>更新日志</h3>
      </div>

      <div v-if="latestRelease" class="xlt-changelog__latest">
        <span>Latest</span>
        <strong>{{ latestRelease.version }}</strong>
        <time>{{ latestRelease.date }}</time>
      </div>
    </header>

    <div class="xlt-changelog__toolbar">
      <span class="xlt-changelog__source">
        {{ sourceLabel }}
      </span>
      <div class="xlt-changelog__actions">
        <a
          href="https://github.com/xiaoLangtou/xlt-token/releases"
          target="_blank"
          rel="noreferrer"
        >
          GitHub Releases
        </a>
        <a href="https://www.npmjs.com/package/xlt-token" target="_blank" rel="noreferrer"> npm </a>
      </div>
    </div>

    <div class="xlt-changelog__list">
      <article v-for="release in releases" :key="release.version" class="xlt-release">
        <section class="xlt-release__card">
          <header class="xlt-release__header">
            <div>
              <div class="xlt-release__meta">
                <time>{{ release.date }}</time>
                <span>{{ release.source }}</span>
              </div>
              <h2>{{ release.version }}</h2>
            </div>
            <a
              v-if="release.compare"
              class="xlt-release__compare"
              :href="release.compare"
              target="_blank"
              rel="noreferrer"
            >
              Full changelog
            </a>
          </header>

          <p class="xlt-release__summary" v-html="inlineMarkdown(release.summary)" />

          <div class="xlt-release__sections">
            <section
              v-for="(section, sectionIndex) in release.sections"
              :key="section.title"
              class="xlt-release-section"
              :class="sectionClass(section.title)"
            >
              <h3>{{ section.title }}</h3>

              <template v-for="(block, index) in section.blocks" :key="index">
                <h4 v-if="block.type === 'subheading'">
                  {{ block.text }}
                </h4>

                <p v-else-if="block.type === 'paragraph'" v-html="block.html" />

                <ul v-else-if="block.type === 'list'">
                  <li v-for="item in block.items" :key="item" v-html="item" />
                </ul>

                <div
                  v-else-if="block.type === 'code'"
                  class="xlt-release-code"
                  v-html="codeBlockHtml(block, release.version, sectionIndex, index)"
                />

                <table v-else-if="block.type === 'table'">
                  <thead>
                    <tr>
                      <th v-for="header in block.headers" :key="header" v-html="header" />
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="(row, rowIndex) in block.rows" :key="rowIndex">
                      <td v-for="(cell, cellIndex) in row" :key="cellIndex" v-html="cell" />
                    </tr>
                  </tbody>
                </table>
              </template>
            </section>
          </div>
        </section>
      </article>
    </div>
  </div>
</template>

<style scoped>
.xlt-changelog {
  width: min(100%, 1040px);
  margin: 0 auto;
  padding: 2px 0 36px;
}

.xlt-changelog__header {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 24px;
  padding-bottom: 22px;
  border-bottom: 1px solid var(--x-border);
}

.xlt-changelog__title {
  min-width: 0;
}

.xlt-changelog__eyebrow {
  display: block;
  margin: 0 0 6px;
  color: var(--x-brand);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.xlt-changelog__title h3 {
  margin: 0;
  color: var(--x-text);
  font-size: 1.375rem;
  line-height: 1.25;
  font-weight: 700;
  letter-spacing: 0;
}

.xlt-changelog__latest {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  flex: 0 0 auto;
  min-height: 32px;
  padding: 0 10px;
  border: 1px solid var(--x-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--x-surface) 78%, transparent);
}

.xlt-changelog__latest span {
  color: var(--x-text-2);
  font-size: 0.6875rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.xlt-changelog__latest strong {
  color: var(--x-text);
  font-size: 0.875rem;
}

.xlt-changelog__latest time {
  color: var(--x-text-3);
  font-size: 0.75rem;
}

.xlt-changelog__latest strong::before,
.xlt-changelog__latest time::before {
  content: "";
  display: inline-block;
  width: 4px;
  height: 4px;
  margin: 0 8px 0 0;
  border-radius: 999px;
  background: var(--x-border);
  vertical-align: 0.15em;
}

.xlt-changelog__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 18px 0 30px;
}

.xlt-changelog__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.xlt-changelog__actions a,
.xlt-release__compare {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border: 1px solid var(--x-border);
  border-radius: 8px;
  background: color-mix(in srgb, var(--x-surface) 82%, transparent);
  color: var(--x-text) !important;
  font-size: 0.8125rem;
  font-weight: 650;
  text-decoration: none !important;
}

.xlt-changelog__actions a:hover,
.xlt-release__compare:hover {
  border-color: color-mix(in srgb, var(--x-brand) 34%, var(--x-border));
  background: var(--x-surface);
}

.xlt-changelog__source {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 10px;
  border: 1px solid var(--x-border-soft);
  border-radius: 8px;
  color: var(--x-text-3);
  font-size: 0.8125rem;
}

.xlt-changelog__list {
  display: grid;
  gap: 24px;
}

.xlt-release {
  min-width: 0;
}

.xlt-release__card {
  overflow: hidden;
  border-radius: 8px;
  box-shadow: var(--x-shadow);
}

.xlt-release__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 26px 28px 18px;
  border-bottom: 1px solid var(--x-border-soft);
}

.xlt-release__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: var(--x-text-3);
  font-size: 0.8125rem;
}

.xlt-release__meta time {
  color: var(--x-text-2);
  font-weight: 650;
}

.xlt-release__meta span {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.xlt-release__meta span::before {
  content: "";
  width: 4px;
  height: 4px;
  border-radius: 999px;
  background: var(--x-text-3);
}

.xlt-release__header h2 {
  margin: 0;
  color: var(--x-text);
  font-size: clamp(1.65rem, 3vw, 2.35rem);
  line-height: 1.05;
  letter-spacing: 0;
}

.xlt-release__summary {
  margin: 0;
  padding: 20px 28px;
  border-bottom: 1px solid var(--x-border-soft);
  background: color-mix(in srgb, var(--x-brand-soft) 38%, transparent);
  color: var(--x-text-2);
  font-size: 0.96rem;
  line-height: 1.75;
}

.xlt-release__sections {
  display: grid;
  gap: 0;
}

.xlt-release-section {
  padding: 24px 28px;
}

.xlt-release-section + .xlt-release-section {
  border-top: 1px solid var(--x-border-soft);
}

.xlt-release-section h3 {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 14px;
  color: var(--x-text);
  font-size: 1rem;
  line-height: 1.3;
  letter-spacing: 0;
}

.xlt-release-section h3::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--x-text-3);
}

.xlt-release-section.is-highlight h3::before,
.xlt-release-section.is-feature h3::before {
  background: #22c55e;
}

.xlt-release-section.is-fix h3::before {
  background: #0ea5e9;
}

.xlt-release-section.is-breaking h3::before {
  background: #f59e0b;
}

.xlt-release-section.is-quality h3::before {
  background: var(--x-brand);
}

.xlt-release-section h4 {
  margin: 18px 0 8px;
  color: var(--x-text);
  font-size: 0.94rem;
  line-height: 1.4;
}

.xlt-release-section p,
.xlt-release-section li {
  color: var(--x-text-2);
  font-size: 0.925rem;
  line-height: 1.72;
}

.xlt-release-section p {
  margin: 10px 0;
}

.xlt-release-section ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.xlt-release-section li {
  position: relative;
  padding-left: 18px;
}

.xlt-release-section li::before {
  content: "";
  position: absolute;
  top: 0.82em;
  left: 0;
  width: 5px;
  height: 5px;
  border-radius: 999px;
  background: var(--x-text-3);
}

.xlt-release-section :deep(:not(pre) > code) {
  border: 1px solid var(--x-border-soft);
  border-radius: 5px;
  padding: 0.08em 0.38em;
  background: var(--x-code-bg);
  color: var(--x-text);
  font-size: 0.88em;
}

.xlt-release-section :deep(a) {
  color: var(--x-brand) !important;
  font-weight: 600;
  text-decoration: none !important;
}

.xlt-release-code {
  margin: 14px 0 0;
}

.xlt-release-code :deep(pre) {
  overflow: auto;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--x-code-border);
  border-radius: 8px;
  background: var(--x-code-bg) !important;
  color: var(--x-text);
  font-family: var(--vp-font-family-mono);
  font-size: 0.8125rem;
  line-height: 1.7;
}

.xlt-release-code :deep(code) {
  display: block;
  width: max-content;
  min-width: 100%;
  font-family: var(--vp-font-family-mono);
}

.xlt-release-section table {
  display: table;
  width: 100%;
  margin: 14px 0 0;
  border-collapse: collapse;
  font-size: 0.875rem;
}

.xlt-release-section th,
.xlt-release-section td {
  padding: 10px 12px;
  border: 1px solid var(--x-border);
  text-align: left;
}

.xlt-release-section th {
  background: var(--x-surface-2);
  color: var(--x-text);
  font-weight: 700;
}

.xlt-release-section td {
  color: var(--x-text-2);
}

@media (max-width: 820px) {
  .xlt-changelog {
    padding-top: 0;
  }

  .xlt-changelog__header {
    align-items: stretch;
    flex-direction: column;
  }

  .xlt-changelog__latest {
    align-self: flex-start;
    flex-wrap: wrap;
  }

  .xlt-changelog__toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .xlt-release__header {
    flex-direction: column;
    padding: 22px 20px 16px;
  }

  .xlt-release__summary,
  .xlt-release-section {
    padding-right: 20px;
    padding-left: 20px;
  }
}
</style>
