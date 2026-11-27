let replacements: [RegExp, (match: string) => string][] = [
  [/\bslates\b/gi, match => (match[0] == 'S' ? 'Integrations' : 'integrations')],
  [/\bslate\b/gi, match => (match[0] == 'S' ? 'Integration' : 'integration')]
];

let identifierKeys = new Set(['id', 'path', 'file', 'key']);

export let neutralizeInternalTerms = (text: string) =>
  replacements.reduce((result, [pattern, replace]) => result.replace(pattern, replace), text);

export let neutralizeInternalTermsDeep = <T>(value: T, key?: string): T => {
  if (typeof value == 'string')
    return (key && identifierKeys.has(key) ? value : neutralizeInternalTerms(value)) as T;
  if (Array.isArray(value)) return value.map(item => neutralizeInternalTermsDeep(item)) as T;
  if (value && typeof value == 'object')
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, neutralizeInternalTermsDeep(v, k)])
    ) as T;
  return value;
};
