function withConditionalTypes(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  const entry = value as Record<string, unknown>;
  const importPath = entry.import;
  const requirePath = entry.require;

  if (typeof importPath !== 'string' || typeof requirePath !== 'string') return value;

  return {
    import: {
      types: importPath.replace(/\.mjs$/, '.d.mts'),
      default: importPath,
    },
    require: {
      types: requirePath.replace(/\.cjs$/, '.d.cts'),
      default: requirePath,
    },
  };
}

export function dualPackageExports(exports: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(exports).map(([key, value]) => [key, withConditionalTypes(value)]),
  );
}
