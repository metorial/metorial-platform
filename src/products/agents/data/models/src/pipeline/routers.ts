let routerWords = [
  'auto',
  'router',
  'fusion',
  'smart',
  'balanced',
  'best',
  'cheapest',
  'cheap',
  'fastest',
  'default',
  'pareto-code'
];

let routerPattern = new RegExp(`^(${routerWords.join('|')})(-(router|model|free))?$`);

export let isRouterId = (vendorModelId: string) => {
  let segments = vendorModelId
    .toLowerCase()
    .replace(/:[^/]*$/, '')
    .split('/');
  let last = segments.pop()!;
  let namespace = segments.join('/');

  if (
    routerPattern.test(last) ||
    /^auto-model/.test(last) ||
    /(^|[-.])(router|auto)$/.test(last)
  )
    return true;
  if (/(^|\/|-)auto$/.test(namespace)) return true;
  return namespace === 'openrouter' && last === 'free';
};
