import { markdownCorpus } from '../markdownCorpus';

let excludedFromFuzz = ['agentBlockForged', 'commentThreadForged', 'imagePlaceholderForged'];

let glue = ['\n\n', '\n', '\n\n\n', ' ', '\n  ', '\n> ', '\n- ', '\n\n  '];

let wrappers: ((value: string) => string)[] = [
  value => value,
  value => `> ${value.replaceAll('\n', '\n> ')}`,
  value => `- ${value.replaceAll('\n', '\n  ')}`,
  value => `1. ${value.replaceAll('\n', '\n   ')}`,
  value => `<info>\n\n${value}\n\n</info>`,
  value => `**${value.replaceAll('\n', ' ')}**`,
  value => `<u>${value.replaceAll('\n', ' ')}</u>`,
  value => `<div>${value}</div>`,
  value => `<p>${value}</p>`
];

let mutationTokens = [
  '<p>',
  '</p>',
  '<table>',
  '</table>',
  '<tr>',
  '<td>',
  '<th colspan="2">',
  '<u>',
  '</u>',
  '<mark>',
  '<sub>',
  '<info>',
  '</info>',
  '<warning>',
  '<equation>',
  '</equation>',
  '<pre>',
  '</pre>',
  '<code>',
  '</code>',
  '<li>',
  '<ul>',
  '</ul>',
  '<br>',
  '<hr>',
  '<b>',
  '<i>',
  '<a href="https://x.dev">',
  '</a>',
  '<img src="x">',
  '<div data-callout-type="warning">',
  '</div>',
  '<span style="font-weight: bold">',
  '</span>',
  '<h2>',
  '</h2>',
  '<blockquote>',
  '<!--',
  '-->',
  '&amp;',
  '&nbsp;',
  '&#10;',
  '*',
  '**',
  '_',
  '~~',
  '`',
  '```',
  '|',
  '| - |',
  '- [ ] ',
  '- [x] ',
  '> ',
  '# ',
  '1. ',
  '  ',
  '\t',
  '\n',
  '\n\n',
  '\r\n',
  '\\',
  '[',
  '](https://x.dev)',
  '![a](b)',
  '<',
  '>'
];

export let createRandom = (initialSeed: number) => {
  let seed = initialSeed >>> 0;

  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
};

let corpusSnippets = Object.entries(markdownCorpus)
  .filter(([name, value]) => !excludedFromFuzz.includes(name) && value.length < 400)
  .map(([, value]) => value);

let pick = <T>(random: () => number, items: T[]) =>
  items[Math.floor(random() * items.length)]!;

export let structuredDocument = (random: () => number) => {
  let parts = Array.from({ length: 1 + Math.floor(random() * 5) }, () =>
    pick(random, wrappers)(pick(random, corpusSnippets))
  );

  return parts.reduce((joined, part) => `${joined}${pick(random, glue)}${part}`);
};

export let mutatedDocument = (random: () => number) => {
  let text = pick(random, corpusSnippets);

  for (let i = 0, count = 1 + Math.floor(random() * 6); i < count; i++) {
    let at = Math.floor(random() * (text.length + 1));
    let operation = random();

    if (operation < 0.7) {
      text = text.slice(0, at) + pick(random, mutationTokens) + text.slice(at);
    } else if (operation < 0.9) {
      text = text.slice(0, at) + text.slice(at + 1 + Math.floor(random() * 4));
    } else {
      text = text + pick(random, glue) + pick(random, corpusSnippets);
    }
  }

  return text;
};

export let shrinkMarkdown = (markdown: string, stillFails: (candidate: string) => boolean) => {
  let current = markdown;
  let changed = true;

  while (changed) {
    changed = false;

    for (let size of [64, 16, 4, 1]) {
      for (let i = 0; i < current.length;) {
        let candidate = current.slice(0, i) + current.slice(i + size);

        if (candidate.length > 0 && stillFails(candidate)) {
          current = candidate;
          changed = true;
        } else {
          i += size;
        }
      }
    }
  }

  return current;
};
