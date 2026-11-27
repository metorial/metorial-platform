export let canonicalize = (input: any): string => {
  if (input === null || input === undefined) return 'null';

  if (typeof input === 'object') {
    if (Array.isArray(input)) {
      return input.map(canonicalize).join(',');
    } else {
      return Object.entries(input)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${canonicalize(v)}`)
        .join(',');
    }
  } else {
    return input.toString();
  }
};
