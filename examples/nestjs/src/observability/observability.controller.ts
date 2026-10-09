import { Controller, Get, Query } from "@nestjs/common";
import { StpUtil, XltCheckRole, XltMode } from "@xlt-token/nestjs";
import { demoEventBuffer } from "../config/event-buffer";

/**
 * 可观测性演示接口：为交互演示页的"可观测性面板"提供数据。
 * 事件来自 @xlt-token/inspector 的事件缓冲（仅含 token 指纹，无原始凭据）。
 */
@Controller("observability")
export class ObservabilityController {
  /** 增量拉取审计事件（新→旧）；`after` 传上一次响应的 `latest` */
  @XltCheckRole("admin", { mode: XltMode.AND })
  @Get("events")
  events(@Query("after") after?: string, @Query("limit") limit?: string) {
    const afterSeq = Number(after ?? 0) || 0;
    const max = Math.min(Math.max(Number(limit ?? 50) || 50, 1), 200);
    return demoEventBuffer.snapshot(afterSeq, max);
  }

  /** 面板总览：在线会话数 + 缓冲事件统计 */
  @XltCheckRole("admin", { mode: XltMode.AND })
  @Get("overview")
  async overview() {
    const stats = demoEventBuffer.stats();
    return {
      onlineCount: await StpUtil.getOnlineCount(),
      eventsTracked: stats.tracked,
      byType: stats.byType,
      logSchema: "xlt-token.audit.v1",
    };
  }
}
