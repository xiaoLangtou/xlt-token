/**
 * 通配符匹配，支持*通配符
 * @param pattern 匹配模式
 * @param target 目标字符串
 */
export function matchPermission(pattern: string, target: string): boolean {
  if (pattern === '*') return true;
  if (pattern === target) return true;

  const patternSegments = pattern.split(':');
  const targetSegments = target.split(':');

  for (let i = 0; i < patternSegments.length; i++) {
    if (patternSegments[i] === '*') return true;
    if (patternSegments[i] !== targetSegments[i]) return false;
  }
  return patternSegments.length === targetSegments.length;
}
