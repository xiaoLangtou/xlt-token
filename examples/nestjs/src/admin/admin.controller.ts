import { Controller, Get } from "@nestjs/common";
import { XltCheckRole } from "@xlt-token/nestjs";
import { demoEventBuffer } from "../config/event-buffer";

@Controller("admin")
export class AdminController {
  @XltCheckRole("admin")
  @Get("hooks")
  hooks() {
    const { events, latest } = demoEventBuffer.snapshot(0, 50);
    return { events, latest };
  }

  @XltCheckRole("admin")
  @Get("dashboard")
  dashboard() {
    return {
      message: "管理员面板",
      tips: ["GET /session/online-count", "GET /admin/hooks", "POST /session/kickout"],
    };
  }
}
