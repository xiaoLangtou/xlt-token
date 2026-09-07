import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
import TwoslashFloatingVue from "@shikijs/vitepress-twoslash/client";
import Layout from "./Layout.vue";
import "./styles/index.css";
import "@shikijs/vitepress-twoslash/style.css";

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.use(TwoslashFloatingVue);
  },
} satisfies Theme;
