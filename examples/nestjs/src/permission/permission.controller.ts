import { Controller, Get } from "@nestjs/common";
import { XltCheckPermission, XltMode } from "@xlt-token/nestjs";

@Controller("permission")
export class PermissionController {
  @XltCheckPermission("user:read")
  @Get("read")
  read() {
    return { action: "read", ok: true };
  }

  @XltCheckPermission(["user:read", "user:delete"], { mode: XltMode.AND })
  @Get("delete")
  deleteAction() {
    return { action: "delete", ok: true };
  }

  /** admin 拥有 order:*，可匹配 order:create */
  @XltCheckPermission("order:create")
  @Get("order-create")
  orderCreate() {
    return { action: "order:create", ok: true };
  }
}
