import { describe, it, expect } from 'vitest';
import { matchPermission } from './perm-pattern-match';

describe('matchPermission', () => {
  describe('精确匹配', () => {
    it('完全相同返回 true', () => {
      expect(matchPermission('user:add', 'user:add')).toBe(true);
    });

    it('不同返回 false', () => {
      expect(matchPermission('user:add', 'user:delete')).toBe(false);
    });

    it('前缀相同但段数不同返回 false', () => {
      expect(matchPermission('user:add', 'user:add:sub')).toBe(false);
    });

    it('目标比模式短返回 false', () => {
      expect(matchPermission('user:add:sub', 'user:add')).toBe(false);
    });
  });

  describe('通配符 *', () => {
    it('单独 * 匹配任意字符串', () => {
      expect(matchPermission('*', 'anything')).toBe(true);
      expect(matchPermission('*', 'user:add')).toBe(true);
      expect(matchPermission('*', 'a:b:c:d')).toBe(true);
    });

    it('user:* 匹配 user:add', () => {
      expect(matchPermission('user:*', 'user:add')).toBe(true);
    });

    it('user:* 匹配 user:edit', () => {
      expect(matchPermission('user:*', 'user:edit')).toBe(true);
    });

    it('user:* 匹配 user:add:sub（* 匹配后续所有段）', () => {
      expect(matchPermission('user:*', 'user:add:sub')).toBe(true);
    });

    it('order:* 不匹配 user:add', () => {
      expect(matchPermission('order:*', 'user:add')).toBe(false);
    });

    it('a:b:* 匹配 a:b:c', () => {
      expect(matchPermission('a:b:*', 'a:b:c')).toBe(true);
    });

    it('a:b:* 匹配 a:b:c:d', () => {
      expect(matchPermission('a:b:*', 'a:b:c:d')).toBe(true);
    });

    it('a:*:c 遇到 * 即返回 true', () => {
      expect(matchPermission('a:*:c', 'a:b:c')).toBe(true);
      expect(matchPermission('a:*:c', 'a:b:d')).toBe(true);
    });
  });

  describe('边界情况', () => {
    it('空字符串精确匹配', () => {
      expect(matchPermission('', '')).toBe(true);
    });

    it('空字符串不匹配非空', () => {
      expect(matchPermission('', 'user')).toBe(false);
    });

    it('单段无冒号精确匹配', () => {
      expect(matchPermission('admin', 'admin')).toBe(true);
      expect(matchPermission('admin', 'user')).toBe(false);
    });
  });
});
