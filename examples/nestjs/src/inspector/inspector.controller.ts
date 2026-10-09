import { Controller, Get, Post, Req, Res } from "@nestjs/common";
import { getDefaultXltInstance } from "@xlt-token/core";
import {
  buildInspectorRequest,
  createInspectorBridge,
  INSPECTOR_HTML,
  type InspectorBridge,
} from "@xlt-token/inspector";
import { StpUtil, XltIgnore } from "@xlt-token/nestjs";
import type { Request, Response } from "express";
import { demoEventBuffer } from "../config/event-buffer";

let bridge: InspectorBridge | null = null;

/**
 * 官方监控台桥（懒初始化：等待 XltTokenModule 完成实例装配）。
 * 鉴权：Bearer token → getLoginIdByToken → admin 角色。
 * 演示开启 allowMutations（踢人 / 强制下线），生产环境按需关闭。
 */
function getBridge(): InspectorBridge {
  if (!bridge) {
    bridge = createInspectorBridge({
      instance: () => getDefaultXltInstance(),
      buffer: demoEventBuffer,
      auth: async (_request, context) => {
        if (!context.bearerToken) return false;
        const loginId = await StpUtil.getLoginIdByToken(context.bearerToken);
        if (loginId == null) return false;
        return StpUtil.hasRole(String(loginId), "admin");
      },
      allowMutations: true,
    });
  }
  return bridge;
}

async function respond(path: string, req: Request, res: Response): Promise<void> {
  const response = await getBridge().handle(buildInspectorRequest(path, req));
  res.status(response.status).json(response.body);
}

/**
 * 官方监控台：GET /inspector 打开页面（单文件、零构建），
 * GET/POST /inspector/api/* 为数据接口（鉴权见上方 auth 回调）。
 */
@Controller("inspector")
export class InspectorController {
  @Get()
  @XltIgnore()
  page(@Res() res: Response) {
    res.type("html").send(INSPECTOR_HTML);
  }

  @Get("api/overview")
  @XltIgnore()
  overview(@Req() req: Request, @Res() res: Response) {
    return respond("/overview", req, res);
  }

  @Get("api/events")
  @XltIgnore()
  events(@Req() req: Request, @Res() res: Response) {
    return respond("/events", req, res);
  }

  @Get("api/metrics")
  @XltIgnore()
  metrics(@Req() req: Request, @Res() res: Response) {
    return respond("/metrics", req, res);
  }

  @Get("api/sessions")
  @XltIgnore()
  sessions(@Req() req: Request, @Res() res: Response) {
    return respond("/sessions", req, res);
  }

  @Get("api/session-devices")
  @XltIgnore()
  sessionDevices(@Req() req: Request, @Res() res: Response) {
    return respond("/session-devices", req, res);
  }

  @Post("api/actions/kickout")
  @XltIgnore()
  kickout(@Req() req: Request, @Res() res: Response) {
    return respond("/actions/kickout", req, res);
  }

  @Post("api/actions/logout")
  @XltIgnore()
  logout(@Req() req: Request, @Res() res: Response) {
    return respond("/actions/logout", req, res);
  }
}
