import {
  createExpressContext,
  NotLoginException as CoreNotLoginException,
  NotPermissionException as CoreNotPermissionException,
  NotRoleException as CoreNotRoleException,
  NotSafeException as CoreNotSafeException,
} from '@xlt-token/core';
import { NotLoginException } from '../exceptions/not-login.exception';
import { NotPermissionException } from '../exceptions/not-permission.exception';
import { NotRoleException } from '../exceptions/not-role.exception';
import { NotSafeException } from '../exceptions/not-safe.exception';

export function createNestHttpContext(req: any, res: any) {
  return createExpressContext(req, res);
}

export function rethrowCoreAuthException(error: unknown): never {
  if (error instanceof CoreNotLoginException) {
    throw new NotLoginException(error.type, error.token);
  }
  if (error instanceof CoreNotPermissionException) {
    throw new NotPermissionException(error.permission, error.mode);
  }
  if (error instanceof CoreNotRoleException) {
    throw new NotRoleException(error.role, error.mode);
  }
  if (error instanceof CoreNotSafeException) {
    throw new NotSafeException(error.business);
  }
  throw error;
}
