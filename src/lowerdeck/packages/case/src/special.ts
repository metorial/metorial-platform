// Blatantly stolen from https://github.com/vercel/title

let conjunctions = ['for', 'and', 'nor', 'but', 'or', 'yet', 'so'];

let articles = ['a', 'an', 'the'];

let prepositions = [
  'aboard',
  'about',
  'above',
  'across',
  'after',
  'against',
  'along',
  'amid',
  'among',
  'anti',
  'around',
  'as',
  'at',
  'before',
  'behind',
  'below',
  'beneath',
  'beside',
  'besides',
  'between',
  'beyond',
  'but',
  'by',
  'concerning',
  'considering',
  'despite',
  'down',
  'during',
  'except',
  'excepting',
  'excluding',
  'following',
  'for',
  'from',
  'in',
  'inside',
  'into',
  'like',
  'minus',
  'near',
  'of',
  'off',
  'on',
  'onto',
  'opposite',
  'over',
  'past',
  'per',
  'plus',
  'regarding',
  'round',
  'save',
  'since',
  'than',
  'through',
  'to',
  'toward',
  'towards',
  'under',
  'underneath',
  'unlike',
  'until',
  'up',
  'upon',
  'versus',
  'via',
  'with',
  'within',
  'without'
];

let specials = [
  'Metorial',
  'MCP',
  'CLI',
  'API',
  'HTTP',
  'HTTPS',
  'JSX',
  'DNS',
  'URL',
  'CI',
  'CD',
  'CDN',
  'package.json',
  'package.lock',
  'yarn.lock',
  'GitHub',
  'GitLab',
  'CSS',
  'Sass',
  'JS',
  'JavaScript',
  'TypeScript',
  'HTML',
  'WordPress',
  'Next.js',
  'Node.js',
  'Webpack',
  'Docker',
  'Bash',
  'Kubernetes',
  'SWR',
  'TinaCMS',
  'UI',
  'UX',
  'TS',
  'TSX',
  'iPhone',
  'iPad',
  'watchOS',
  'iOS',
  'iPadOS',
  'macOS',
  'PHP',
  'composer.json',
  'composer.lock',
  'CMS',
  'SQL',
  'C',
  'C#',
  'GraphQL',
  'GraphiQL',
  'JWT',
  'JWTs'
];

let specialMap = new Map([
  ...conjunctions.map(c => [c.toLowerCase(), c] as const),
  ...articles.map(a => [a.toLowerCase(), a] as const),
  ...prepositions.map(p => [p.toLowerCase(), p] as const),
  ...specials.map(s => [s.toLowerCase(), s] as const)
]);

export let titleWord = (word: string) => {
  let lower = word.toLowerCase();
  if (specialMap.has(lower)) {
    return specialMap.get(lower)!;
  }

  return word.charAt(0).toUpperCase() + word.slice(1);
};

export let word = (word: string) => {
  let lower = word.toLowerCase();
  if (specialMap.has(lower)) {
    return specialMap.get(lower)!;
  }

  return word.charAt(0).toUpperCase() + word.slice(1);
};
