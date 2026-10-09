import { describe, expect, it } from "vitest";
import { INSPECTOR_HTML } from "../src/index.js";

describe("INSPECTOR_HTML", () => {
  it("contains the single-file page shell", () => {
    expect(INSPECTOR_HTML).toContain("<!doctype html>");
    expect(INSPECTOR_HTML).toContain("<title>xlt-token Inspector</title>");
    expect(INSPECTOR_HTML).toContain("</script>");
  });

  it("inline script parses without syntax errors (guards template-literal escapes)", () => {
    const script = INSPECTOR_HTML.split("<script>")[1]?.split("</script>")[0];
    expect(script).toBeTruthy();

    // 编译（不执行）内联脚本：模板字面量里的 `\` 会被 TS 转义吞掉，
    // 例如 /\/+$/ 变成 //+$/（注释），必须在此类回归被浏览器暴露前拦截。
    expect(() => new Function(script as string)).not.toThrow();
  });

  it("keeps the location.pathname base logic intact after escaping", () => {
    expect(INSPECTOR_HTML).toContain("location.pathname.replace(/\\/+$/, \"\")");
  });
});
