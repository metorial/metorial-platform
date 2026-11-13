export let isPlainObject = (value: unknown): value is Record<string, any> =>
  typeof value === 'object' &&
  value !== null &&
  !Array.isArray(value) &&
  !(value instanceof Date);

export let deepMerge = (base: Record<string, any>, child: Record<string, any>) => {
  let result: Record<string, any> = { ...base };

  for (let [key, value] of Object.entries(child)) {
    let existing = result[key];
    result[key] =
      isPlainObject(existing) && isPlainObject(value) ? deepMerge(existing, value) : value;
  }

  return result;
};

export let omitPath = (target: Record<string, any>, path: string) => {
  let parts = path.split('.');
  let cursor: any = target;

  for (let part of parts.slice(0, -1)) {
    if (!isPlainObject(cursor[part])) return;
    cursor[part] = { ...cursor[part] };
    cursor = cursor[part];
  }

  delete cursor[parts[parts.length - 1]!];
};

export let uniq = <T>(items: Iterable<T>) => [...new Set(items)];

export let sortBy = <T>(items: T[], key: (item: T) => string | number) =>
  [...items].sort((a, b) => {
    let ka = key(a);
    let kb = key(b);
    return ka < kb ? -1 : ka > kb ? 1 : 0;
  });

export let groupBy = <T>(items: Iterable<T>, key: (item: T) => string) => {
  let groups = new Map<string, T[]>();

  for (let item of items) {
    let k = key(item);
    let group = groups.get(k);
    if (group) group.push(item);
    else groups.set(k, [item]);
  }

  return groups;
};

export let titleCase = (slug: string, casing: Record<string, string> = {}) =>
  slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(part => casing[part] ?? part[0]!.toUpperCase() + part.slice(1))
    .join(' ');

export let compareVersionSort = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    let diff = (a[i] ?? -1) - (b[i] ?? -1);
    if (diff !== 0) return diff;
  }

  return 0;
};

export let median = (values: number[]) => {
  if (!values.length) return null;

  let sorted = [...values].sort((a, b) => a - b);
  let mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

export let stableHash = (input: string) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < input.length; i++) {
    let ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
};
