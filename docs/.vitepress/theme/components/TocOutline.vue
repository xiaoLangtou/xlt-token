<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { onContentUpdated, useData } from "vitepress";

interface TocItem {
  id: string;
  link: string;
  title: string;
  depth: number;
  el: HTMLElement;
}

interface RailSpec {
  width: number;
  x: number;
  curveFrom: number | null;
}

const RAIL_X = [8.5, 16.5, 24.5, 32.5];
const TEXT_PAD = [20, 32, 44, 56];
const OVERLAP = 3;

const { theme, frontmatter } = useData();

const items = shallowRef<TocItem[]>([]);
const activeId = ref<string | null>(null);
const listEl = ref<HTMLElement>();
const thumbStyle = ref({ top: "0px", left: "0px", opacity: "0" });

const title = computed(() => {
  const outline = theme.value.outline;
  if (outline && typeof outline === "object" && !Array.isArray(outline) && outline.label) {
    return outline.label;
  }
  return theme.value.outlineTitle || "本页目录";
});

function resolveLevels(): [number, number] | null {
  const outline = frontmatter.value.outline ?? theme.value.outline;
  if (outline === false) return null;
  const level =
    outline && typeof outline === "object" && !Array.isArray(outline) ? outline.level : outline;
  if (level === "deep") return [2, 6];
  if (typeof level === "number") return [level, level];
  if (Array.isArray(level)) return level as [number, number];
  return [2, 2];
}

function collect() {
  const levels = resolveLevels();
  if (!levels) {
    items.value = [];
    return;
  }
  const [high, low] = levels;
  const tags = Array.from({ length: low - high + 1 }, (_, i) => `h${high + i}`).join(",");
  const found = [...document.querySelectorAll<HTMLElement>(`.VPDoc :where(${tags})`)].filter(
    (el) => el.id && el.hasChildNodes(),
  );
  items.value = found.map((el) => {
    let titleText = "";
    for (const node of el.childNodes) {
      if (node.nodeType === 1 && (node as HTMLElement).classList.contains("header-anchor"))
        continue;
      titleText += node.textContent;
    }
    return {
      id: el.id,
      link: `#${el.id}`,
      title: titleText.trim(),
      depth: Math.min(Number(el.tagName[1]) - high + 1, RAIL_X.length),
      el,
    };
  });
  updateActive();
}

function railOf(item: TocItem, index: number): RailSpec {
  const x = RAIL_X[item.depth - 1];
  const prev = index > 0 ? items.value[index - 1] : null;
  const curveFrom = prev && prev.depth !== item.depth ? RAIL_X[prev.depth - 1] : null;
  const width = Math.max(x, curveFrom ?? 0) + 8.5;
  return { width, x, curveFrom };
}

function padOf(item: TocItem) {
  return `${TEXT_PAD[item.depth - 1]}px`;
}

function svgHeight(index: number) {
  return index === items.value.length - 1 ? "100%" : `calc(100% + ${OVERLAP}px)`;
}

function absoluteTop(el: HTMLElement) {
  let top = 0;
  let cur: HTMLElement | null = el;
  while (cur && cur !== document.body) {
    top += cur.offsetTop;
    cur = cur.offsetParent as HTMLElement | null;
  }
  return top;
}

function updateActive() {
  const list = items.value;
  if (!list.length) {
    activeId.value = null;
    return;
  }
  const scrollY = window.scrollY;
  const atBottom = Math.abs(scrollY + window.innerHeight - document.body.offsetHeight) < 1;
  if (atBottom) {
    setActive(list[list.length - 1]);
    return;
  }
  let current: TocItem | null = null;
  for (const item of list) {
    if (absoluteTop(item.el) > scrollY + 140) break;
    current = item;
  }
  setActive(scrollY < 1 ? null : current);
}

function setActive(item: TocItem | null) {
  activeId.value = item?.id ?? null;
  if (!item || !listEl.value) {
    thumbStyle.value = { ...thumbStyle.value, opacity: "0" };
    return;
  }
  const anchor = listEl.value.querySelector<HTMLElement>(`a[data-id="${CSS.escape(item.id)}"]`);
  if (!anchor) return;
  thumbStyle.value = {
    top: `${anchor.offsetTop + (anchor.offsetHeight - 16) / 2}px`,
    left: `${RAIL_X[item.depth - 1] - 1}px`,
    opacity: "1",
  };
}

function onClick(event: MouseEvent, item: TocItem) {
  event.preventDefault();
  const target = document.getElementById(item.id);
  if (!target) return;
  history.pushState({}, "", item.link);
  target.scrollIntoView({ block: "start" });
  target.focus({ preventScroll: true });
  setActive(item);
}

let raf = 0;
function onScroll() {
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0;
    updateActive();
  });
}

onMounted(() => {
  collect();
  window.addEventListener("scroll", onScroll, { passive: true });
});

onContentUpdated(() => {
  collect();
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", onScroll);
  if (raf) cancelAnimationFrame(raf);
});
</script>

<template>
  <nav v-if="items.length" class="xlt-toc" aria-labelledby="xlt-toc-title">
    <div id="xlt-toc-title" class="xlt-toc__title" role="heading" aria-level="2">
      <svg
        viewBox="0 0 24 24"
        width="15"
        height="15"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M21 5H3" />
        <path d="M15 12H3" />
        <path d="M17 19H3" />
      </svg>
      {{ title }}
    </div>

    <div ref="listEl" class="xlt-toc__list">
      <div class="xlt-toc__thumb" :style="thumbStyle" aria-hidden="true" />

      <a
        v-for="(item, index) in items"
        :key="item.id"
        :href="item.link"
        :data-id="item.id"
        class="xlt-toc__item"
        :class="{ 'is-active': item.id === activeId }"
        :style="{ paddingInlineStart: padOf(item) }"
        @click="onClick($event, item)"
      >
        <svg
          class="xlt-toc__rail"
          :style="{ width: `${railOf(item, index).width}px`, height: svgHeight(index) }"
          aria-hidden="true"
        >
          <path
            v-if="railOf(item, index).curveFrom !== null"
            :d="`M ${railOf(item, index).curveFrom} 0 C ${railOf(item, index).curveFrom} 8, ${railOf(item, index).x} 4, ${railOf(item, index).x} 12`"
            fill="none"
            stroke-width="1"
          />
          <line
            :x1="railOf(item, index).x"
            :y1="railOf(item, index).curveFrom !== null ? 12 : 6"
            :x2="railOf(item, index).x"
            y2="100%"
            stroke-width="1"
          />
        </svg>
        <span class="xlt-toc__text">{{ item.title }}</span>
      </a>
    </div>
  </nav>
</template>
