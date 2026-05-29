import type { XltHooks } from '@xlt-token/core';

const events: Array<{ event: string; at: string; payload: Record<string, unknown> }> = [];

/** 最近 50 条 Hook 事件，供 /admin/hooks 观测 */
export function getRecentHookEvents() {
  return [...events];
}

export function createAuditHooks(): XltHooks {
  const push = (event: string, payload: Record<string, unknown>) => {
    events.unshift({ event, at: new Date().toISOString(), payload });
    if (events.length > 50) events.pop();
    console.log(`[hook:${event}]`, payload);
  };

  return {
    onLogin: (loginId, token, device) => push('login', { loginId, device, token: token.slice(0, 8) }),
    onLogout: (loginId, token, reason) => push('logout', { loginId, reason, token: token.slice(0, 8) }),
    onKickout: (loginId, token) => push('kickout', { loginId, token: token.slice(0, 8) }),
    onReplaced: (loginId, oldToken, newToken) =>
      push('replaced', { loginId, oldToken: oldToken.slice(0, 8), newToken: newToken.slice(0, 8) }),
  };
}
