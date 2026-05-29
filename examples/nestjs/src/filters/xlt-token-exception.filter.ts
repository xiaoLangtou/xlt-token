import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import {
  NotLoginException,
  NotPermissionException,
  NotRoleException,
  NotSafeException,
} from '@xlt-token/nestjs';

/** 统一格式化 xlt-token 业务异常，便于前端按 type 分支处理 */
@Catch(NotLoginException, NotPermissionException, NotRoleException, NotSafeException)
export class XltTokenExceptionFilter implements ExceptionFilter {
  catch(exception: NotLoginException | NotPermissionException | NotRoleException | NotSafeException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const body: Record<string, unknown> = {
      statusCode: exception.getStatus(),
      message: exception.message,
    };

    if (exception instanceof NotLoginException) {
      body.type = exception.type;
      if (exception.token) body.token = exception.token;
    }
    if (exception instanceof NotPermissionException) {
      body.type = 'NOT_PERMISSION';
      body.permission = exception.permission;
      body.mode = exception.mode;
    }
    if (exception instanceof NotRoleException) {
      body.type = 'NOT_ROLE';
      body.role = exception.role;
      body.mode = exception.mode;
    }
    if (exception instanceof NotSafeException) {
      body.type = 'NOT_SAFE';
      body.business = exception.business;
    }

    response.status(exception.getStatus()).json(body);
  }
}
