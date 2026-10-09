/**
 * 监控台单文件页面（零依赖、零构建）。
 * JS 全部使用 DOM textContent 构建，避免注入；数据接口由 bridge 提供。
 */
export const INSPECTOR_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>xlt-token Inspector</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f1115; color: #e6e8ee; font: 14px/1.5 -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
  .topbar { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; padding: 12px 20px; border-bottom: 1px solid #23262e; background: #151821; position: sticky; top: 0; z-index: 10; }
  .brand { font-weight: 700; font-size: 16px; }
  .brand span { color: #7aa2f7; font-weight: 400; margin-left: 6px; }
  .chips { display: flex; flex-wrap: wrap; gap: 6px; flex: 1; }
  .chip { background: #1c2030; border: 1px solid #2a2f42; border-radius: 999px; padding: 2px 10px; font-size: 12px; color: #aab2c5; }
  .chip b { color: #e6e8ee; font-weight: 600; }
  .auth { display: flex; gap: 6px; align-items: center; }
  .auth input { background: #1c2030; border: 1px solid #2a2f42; color: #e6e8ee; border-radius: 6px; padding: 5px 8px; width: 260px; font-size: 12px; }
  .auth input[hidden] { display: none; }
  .hint { font-size: 12px; color: #f7b26a; }
  .hint.ok { color: #6fd08c; }
  main { max-width: 1280px; margin: 0 auto; padding: 16px 20px 40px; }
  .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 14px; }
  .metric { background: #151821; border: 1px solid #23262e; border-radius: 10px; padding: 12px 14px; }
  .metric .num { font-size: 24px; font-weight: 700; }
  .metric .label { font-size: 12px; color: #8b93a7; }
  .grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 14px; }
  @media (max-width: 980px) { .grid { grid-template-columns: 1fr; } }
  .panel { background: #151821; border: 1px solid #23262e; border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; }
  .panel-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px; border-bottom: 1px solid #23262e; }
  .panel-head h2 { font-size: 14px; font-weight: 600; }
  .panel-actions { display: flex; gap: 6px; align-items: center; font-size: 12px; color: #8b93a7; }
  button { background: #1c2030; border: 1px solid #2a2f42; color: #cdd3e1; border-radius: 6px; padding: 4px 10px; font-size: 12px; cursor: pointer; }
  button:hover { border-color: #3a4160; color: #fff; }
  button.primary { background: #2b4bd7; border-color: #2b4bd7; color: #fff; }
  button.danger { border-color: #7a3b3b; color: #f19999; }
  .event-stream { max-height: 520px; overflow-y: auto; padding: 10px 14px; display: flex; flex-direction: column; gap: 6px; }
  .event-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 6px 10px; border: 1px solid #23262e; border-radius: 8px; font-size: 12px; }
  .badge { padding: 1px 8px; border-radius: 999px; font-size: 11px; white-space: nowrap; }
  .badge.ok { background: #173325; color: #6fd08c; }
  .badge.info { background: #1c2740; color: #7aa2f7; }
  .badge.warn { background: #3a2b17; color: #f7b26a; }
  .seq, .time { color: #8b93a7; font-variant-numeric: tabular-nums; }
  .field { color: #cdd3e1; }
  .field.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; color: #8b93a7; }
  .empty { color: #58607a; font-size: 12px; padding: 12px 0; }
  .sessions { padding: 10px 14px; overflow-y: auto; max-height: 520px; }
  .session { border: 1px solid #23262e; border-radius: 8px; margin-bottom: 8px; }
  .session-head { display: flex; gap: 10px; align-items: center; padding: 8px 10px; }
  .session-head .login-id { font-weight: 600; font-family: ui-monospace, Menlo, monospace; }
  .devices { border-top: 1px solid #23262e; padding: 6px 10px 10px 24px; display: none; }
  .devices.open { display: block; }
  .device-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; font-size: 12px; padding: 4px 0; }
  .device-row .device { font-weight: 600; }
  .pager { display: flex; gap: 6px; align-items: center; }
  .status-dot { width: 8px; height: 8px; border-radius: 999px; background: #6fd08c; display: inline-block; margin-right: 6px; }
  .status-dot.paused { background: #f7b26a; }
  .status-dot.error { background: #f19999; }
</style>
</head>
<body>
<header class="topbar">
  <div class="brand">xlt-token<span>Inspector</span></div>
  <div class="chips" id="chips"><span class="chip">连接中…</span></div>
  <div class="auth">
    <span class="hint" id="authHint"><span class="status-dot" id="statusDot"></span></span>
    <input id="tokenInput" type="password" placeholder="Bearer token（需要 admin 权限）" hidden>
    <button id="tokenSave" class="primary" hidden>保存</button>
  </div>
</header>
<main>
  <section class="metrics" id="metrics"></section>
  <div class="grid">
    <section class="panel">
      <div class="panel-head">
        <h2>审计事件</h2>
        <div class="panel-actions">
          <button id="pauseBtn">暂停</button>
          <button id="clearBtn">清空</button>
        </div>
      </div>
      <div class="event-stream" id="events"><div class="empty">等待事件…</div></div>
    </section>
    <section class="panel">
      <div class="panel-head">
        <h2>在线会话</h2>
        <div class="pager">
          <button id="prevPage">上一页</button>
          <span id="pageInfo">第 — 页</span>
          <button id="nextPage">下一页</button>
          <button id="refreshSessions">刷新</button>
        </div>
      </div>
      <div class="sessions" id="sessions"><div class="empty">加载中…</div></div>
    </section>
  </div>
</main>
<script>
(function () {
  "use strict";

  var EVENT_META = {
    "token.logged_in": ["登录", "ok"],
    "token.refreshed": ["刷新", "info"],
    "token.logged_out": ["登出", "info"],
    "token.kicked_out": ["踢出", "warn"],
    "token.replaced": ["顶号", "warn"],
    "token.family_revoked": ["撤销", "warn"]
  };

  var state = { latest: 0, paused: false, page: 0, pageSize: 20, total: 0, allowMutations: false, expanded: {} };
  var $ = function (id) { return document.getElementById(id); };

  // API 前缀跟随页面挂载路径：页面在 /inspector 下就请求 /inspector/api/*，
  // 换任意 prefix（或根路径）挂载都无需改页面。
  var BASE = location.pathname.replace(/\\/+$/, "") || "";

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function savedToken() {
    try { return localStorage.getItem("xlt-inspector-token") || ""; } catch (e) { return ""; }
  }

  function authHeaders() {
    var headers = {};
    var value = savedToken();
    if (value) headers.Authorization = "Bearer " + value;
    return headers;
  }

  function setStatus(kind, text) {
    var dot = $("statusDot");
    dot.className = "status-dot" + (kind === "ok" ? "" : " " + kind);
    var hint = $("authHint");
    while (hint.childNodes.length > 1) hint.removeChild(hint.lastChild);
    if (text) hint.appendChild(document.createTextNode(text));
  }

  function showAuthBar(message) {
    $("tokenInput").hidden = false;
    $("tokenSave").hidden = false;
    setStatus("error", message || "需要鉴权：填入有效 token 后保存");
  }

  function hideAuthBar() {
    $("tokenInput").hidden = true;
    $("tokenSave").hidden = true;
    setStatus("ok", "");
  }

  async function api(path, options) {
    var init = { headers: authHeaders(), credentials: "include" };
    if (options && options.method) init.method = options.method;
    if (options && options.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    try {
      var res = await fetch(BASE + path, init);
      if (res.status === 401 || res.status === 403) {
        showAuthBar(res.status === 403 ? "鉴权失败（403）：当前 token 无权限" : "鉴权失败（401）：token 无效或已过期");
        return null;
      }
      if (res.status === 404) {
        setStatus("error", "接口 404：监控台 API 未挂载到 " + BASE + " 下");
        return null;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      setStatus("error", "请求失败：请确认监控台接口可达");
      return null;
    }
  }

  function timeOf(ms) {
    return new Date(ms).toLocaleTimeString("zh-CN", { hour12: false });
  }

  function renderEvent(event) {
    var meta = EVENT_META[event.type] || [event.type, "info"];
    var row = el("div", "event-row");
    row.appendChild(el("span", "seq", "#" + event.seq));
    row.appendChild(el("span", "badge " + meta[1], meta[0]));
    row.appendChild(el("span", "time", timeOf(event.occurredAt)));
    if (event.loginId !== undefined) row.appendChild(el("span", "field", "loginId: " + event.loginId));
    if (event.device) row.appendChild(el("span", "field", "device: " + event.device));
    if (event.reason) row.appendChild(el("span", "field", "reason: " + event.reason));
    if (event.tokenFingerprint) row.appendChild(el("span", "field mono", "fp: " + event.tokenFingerprint));
    if (event.familyIdFingerprint) row.appendChild(el("span", "field mono", "family: " + event.familyIdFingerprint));
    return row;
  }

  async function pollEvents() {
    if (state.paused) return;
    var data = await api("/api/events?after=" + state.latest + "&limit=100");
    if (!data) return;
    if (data.events && data.events.length) {
      state.latest = data.latest || state.latest;
      var stream = $("events");
      var empty = stream.querySelector(".empty");
      if (empty) empty.remove();
      var frag = document.createDocumentFragment();
      data.events.forEach(function (event) { frag.appendChild(renderEvent(event)); });
      stream.prepend(frag);
      while (stream.children.length > 200) stream.removeChild(stream.lastElementChild);
    } else if (typeof data.latest === "number") {
      state.latest = data.latest;
    }
  }

  function metricCard(label, num) {
    var card = el("div", "metric");
    card.appendChild(el("div", "num", num));
    card.appendChild(el("div", "label", label));
    return card;
  }

  async function refreshMetrics() {
    var data = await api("/api/metrics");
    if (!data) return;
    var wrap = $("metrics");
    wrap.innerHTML = "";
    wrap.appendChild(metricCard("登录次数", data.loginCount));
    wrap.appendChild(metricCard("刷新次数", data.refreshCount));
    wrap.appendChild(metricCard("登出次数", data.logoutCount));
    wrap.appendChild(metricCard("认证异常", data.anomalyCount));
    wrap.appendChild(metricCard("缓冲事件", data.window.tracked + " / " + data.window.capacity));
  }

  async function refreshOverview() {
    var data = await api("/api/overview");
    if (!data) return;
    state.allowMutations = data.allowMutations === true;
    state.latest = Math.max(state.latest, (data.buffer && data.buffer.latest) || 0);
    var chips = $("chips");
    chips.innerHTML = "";
    var info = data.instance || {};
    [
      ["策略", info.strategy],
      ["存储", info.store],
      ["tokenName", info.tokenName],
      ["在线", data.onlineCount],
      ["超时", info.timeout ? Math.round(info.timeout / 86400) + "d" : "—"],
      ["动作", state.allowMutations ? "已开放" : "只读"]
    ].forEach(function (pair) {
      var chip = el("span", "chip");
      chip.appendChild(el("b", null, String(pair[0]) + " "));
      chip.appendChild(document.createTextNode(String(pair[1] ?? "—")));
      chips.appendChild(chip);
    });
    setStatus("ok", "");
  }

  async function mutate(action, body, hint) {
    if (!state.allowMutations) return;
    if (!window.confirm(hint)) return;
    var data = await api("/api/actions/" + action, { method: "POST", body: body });
    if (data) {
      setStatus("ok", "操作已执行");
      await refreshSessions();
      await refreshMetrics();
    }
  }

  function renderSession(loginId) {
    var box = el("div", "session");
    var head = el("div", "session-head");
    head.appendChild(el("span", "login-id", loginId));

    var expandBtn = el("button", null, state.expanded[loginId] ? "收起" : "设备");
    expandBtn.addEventListener("click", async function () {
      state.expanded[loginId] = !state.expanded[loginId];
      await refreshSessions();
    });
    head.appendChild(expandBtn);

    if (state.allowMutations) {
      var kickBtn = el("button", "danger", "踢出默认设备");
      kickBtn.addEventListener("click", function () {
        void mutate("kickout", { loginId: loginId }, "踢出 " + loginId + " 的 default 设备？");
      });
      var logoutBtn = el("button", "danger", "强制下线");
      logoutBtn.addEventListener("click", function () {
        void mutate("logout", { loginId: loginId }, "强制下线 " + loginId + " 的全部会话？");
      });
      head.appendChild(kickBtn);
      head.appendChild(logoutBtn);
    }
    box.appendChild(head);

    if (state.expanded[loginId]) {
      var list = el("div", "devices open");
      list.setAttribute("data-login-id", loginId);
      list.appendChild(el("div", "empty", "加载设备中…"));
      box.appendChild(list);
    }
    return box;
  }

  async function loadExpandedDevices() {
    var targets = document.querySelectorAll(".devices[data-login-id]");
    for (var i = 0; i < targets.length; i++) {
      var loginId = targets[i].getAttribute("data-login-id");
      var data = await api("/api/session-devices?loginId=" + encodeURIComponent(loginId));
      targets[i].innerHTML = "";
      if (!data || !data.devices) {
        targets[i].appendChild(el("div", "empty", "加载失败"));
        continue;
      }
      if (!data.devices.length) {
        targets[i].appendChild(el("div", "empty", "无在线设备"));
        continue;
      }
      data.devices.forEach(function (device) {
        var row = el("div", "device-row");
        row.appendChild(el("span", "device", device.device));
        row.appendChild(el("span", "field mono", "fp: " + device.tokenFingerprint));
        row.appendChild(el("span", "time", "登录于 " + timeOf(device.loginTime)));
        if (state.allowMutations) {
          var kick = el("button", "danger", "踢出");
          kick.addEventListener("click", function () {
            void mutate("kickout", { loginId: loginId, device: device.device }, "踢出 " + loginId + " @ " + device.device + "？");
          });
          row.appendChild(kick);
        }
        targets[i].appendChild(row);
      });
    }
  }

  async function refreshSessions() {
    var data = await api("/api/sessions?page=" + state.page + "&pageSize=" + state.pageSize);
    if (!data) return;
    state.total = data.total || 0;
    var wrap = $("sessions");
    wrap.innerHTML = "";
    if (!data.loginIds || !data.loginIds.length) {
      wrap.appendChild(el("div", "empty", "当前无在线会话"));
    } else {
      data.loginIds.forEach(function (loginId) { wrap.appendChild(renderSession(loginId)); });
    }
    var pages = Math.max(1, Math.ceil(state.total / state.pageSize));
    $("pageInfo").textContent = "第 " + (state.page + 1) + " / " + pages + " 页 · 共 " + state.total + " 人";
    await loadExpandedDevices();
  }

  $("pauseBtn").addEventListener("click", function () {
    state.paused = !state.paused;
    $("pauseBtn").textContent = state.paused ? "继续" : "暂停";
    setStatus(state.paused ? "paused" : "ok", state.paused ? "已暂停" : "");
  });

  $("clearBtn").addEventListener("click", function () {
    $("events").innerHTML = "";
    $("events").appendChild(el("div", "empty", "等待事件…"));
  });

  $("prevPage").addEventListener("click", function () {
    if (state.page > 0) { state.page--; void refreshSessions(); }
  });

  $("nextPage").addEventListener("click", function () {
    var pages = Math.max(1, Math.ceil(state.total / state.pageSize));
    if (state.page < pages - 1) { state.page++; void refreshSessions(); }
  });

  $("refreshSessions").addEventListener("click", function () { void refreshSessions(); });

  $("tokenSave").addEventListener("click", function () {
    try { localStorage.setItem("xlt-inspector-token", $("tokenInput").value.trim()); } catch (e) {}
    hideAuthBar();
    void refreshOverview();
    void refreshSessions();
    void refreshMetrics();
  });

  async function boot() {
    await refreshOverview();
    await refreshMetrics();
    await refreshSessions();
    await pollEvents();
    setInterval(function () { void pollEvents(); }, 2000);
    setInterval(function () { void refreshOverview(); void refreshMetrics(); }, 5000);
  }

  void boot();
})();
</script>
</body>
</html>
`;
