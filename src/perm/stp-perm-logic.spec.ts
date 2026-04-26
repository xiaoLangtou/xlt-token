import { describe, it, expect, beforeEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { StpPermLogic } from './stp-perm-logic';
import { XLT_STP_INTERFACE } from './stp-interface';
import { MemoryStore } from '../store/memory-store';
import {
  DEFAULT_XLT_TOKEN_CONFIG,
  XLT_TOKEN_CONFIG,
  XLT_TOKEN_STORE,
} from '../core/xlt-token-config';
import { XltMode } from '../const';
import { NotPermissionException } from '../exceptions/not-permission.exception';
import { NotRoleException } from '../exceptions/not-role.exception';
import type { StpInterface } from './stp-interface';

const mockStpInterface: StpInterface = {
  getPermissionList: (loginId: string) => {
    const map: Record<string, string[]> = {
      admin: ['user:add', 'user:delete', 'user:edit', 'order:*', 'system:*'],
      viewer: ['user:view'],
      empty: [],
      wildcard: ['*'],
    };
    return map[loginId] ?? [];
  },
  getRoleList: (loginId: string) => {
    const map: Record<string, string[]> = {
      admin: ['admin', 'editor'],
      viewer: ['viewer'],
      empty: [],
    };
    return map[loginId] ?? [];
  },
};

describe('StpPermLogic', () => {
  let logic: StpPermLogic;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StpPermLogic,
        { provide: XLT_STP_INTERFACE, useValue: mockStpInterface },
        { provide: XLT_TOKEN_STORE, useClass: MemoryStore },
        { provide: XLT_TOKEN_CONFIG, useValue: DEFAULT_XLT_TOKEN_CONFIG },
      ],
    }).compile();

    logic = module.get<StpPermLogic>(StpPermLogic);
  });

  describe('hasPermission', () => {
    it('精确匹配返回 true', async () => {
      expect(await logic.hasPermission('admin', 'user:add')).toBe(true);
    });

    it('精确不匹配返回 false', async () => {
      expect(await logic.hasPermission('viewer', 'user:add')).toBe(false);
    });

    it('通配符 order:* 匹配 order:create', async () => {
      expect(await logic.hasPermission('admin', 'order:create')).toBe(true);
    });

    it('通配符 system:* 匹配 system:config:edit', async () => {
      expect(await logic.hasPermission('admin', 'system:config:edit')).toBe(true);
    });

    it('全通配 * 匹配任意权限', async () => {
      expect(await logic.hasPermission('wildcard', 'anything:here')).toBe(true);
    });

    it('空权限列表返回 false', async () => {
      expect(await logic.hasPermission('empty', 'user:add')).toBe(false);
    });

    it('loginId 为空返回 false', async () => {
      expect(await logic.hasPermission('', 'user:add')).toBe(false);
    });

    it('permission 为空返回 false', async () => {
      expect(await logic.hasPermission('admin', '')).toBe(false);
    });

    it('不存在的 loginId 返回 false', async () => {
      expect(await logic.hasPermission('unknown', 'user:add')).toBe(false);
    });
  });

  describe('checkPermission', () => {
    it('AND 模式：全部拥有则通过', async () => {
      await expect(
        logic.checkPermission('admin', ['user:add', 'user:delete'], XltMode.AND),
      ).resolves.toBeUndefined();
    });

    it('AND 模式：缺少一个则抛 NotPermissionException', async () => {
      await expect(
        logic.checkPermission('viewer', ['user:view', 'user:add'], XltMode.AND),
      ).rejects.toThrow(NotPermissionException);
    });

    it('OR 模式：拥有任一则通过', async () => {
      await expect(
        logic.checkPermission('viewer', ['user:view', 'user:add'], XltMode.OR),
      ).resolves.toBeUndefined();
    });

    it('OR 模式：全部没有则抛 NotPermissionException', async () => {
      await expect(
        logic.checkPermission('viewer', ['user:add', 'user:delete'], XltMode.OR),
      ).rejects.toThrow(NotPermissionException);
    });

    it('通配符在 AND 模式下生效', async () => {
      await expect(
        logic.checkPermission('admin', ['order:create', 'order:delete'], XltMode.AND),
      ).resolves.toBeUndefined();
    });

    it('空 loginId 抛异常', async () => {
      await expect(
        logic.checkPermission('', ['user:add'], XltMode.AND),
      ).rejects.toThrow(NotPermissionException);
    });
  });

  describe('hasRole', () => {
    it('拥有角色返回 true', async () => {
      expect(await logic.hasRole('admin', 'admin')).toBe(true);
    });

    it('不拥有角色返回 false', async () => {
      expect(await logic.hasRole('viewer', 'admin')).toBe(false);
    });

    it('空角色列表返回 false', async () => {
      expect(await logic.hasRole('empty', 'admin')).toBe(false);
    });

    it('loginId 为空返回 false', async () => {
      expect(await logic.hasRole('', 'admin')).toBe(false);
    });

    it('role 为空返回 false', async () => {
      expect(await logic.hasRole('admin', '')).toBe(false);
    });
  });

  describe('checkRole', () => {
    it('AND 模式：全部拥有则通过', async () => {
      await expect(
        logic.checkRole('admin', ['admin', 'editor'], XltMode.AND),
      ).resolves.toBeUndefined();
    });

    it('AND 模式：缺少一个则抛 NotRoleException', async () => {
      await expect(
        logic.checkRole('admin', ['admin', 'super'], XltMode.AND),
      ).rejects.toThrow(NotRoleException);
    });

    it('OR 模式：拥有任一则通过', async () => {
      await expect(
        logic.checkRole('admin', ['admin', 'super'], XltMode.OR),
      ).resolves.toBeUndefined();
    });

    it('OR 模式：全部没有则抛 NotRoleException', async () => {
      await expect(
        logic.checkRole('viewer', ['admin', 'super'], XltMode.OR),
      ).rejects.toThrow(NotRoleException);
    });

    it('空 loginId 抛异常', async () => {
      await expect(
        logic.checkRole('', ['admin'], XltMode.AND),
      ).rejects.toThrow(NotRoleException);
    });
  });
});
