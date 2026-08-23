import { parse } from 'yaml';

let frontmatterRegex = /^(?:\uFEFF)?---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

let isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export let parseSkillDocumentFrontmatter = (content: string) => {
  let match = content.match(frontmatterRegex);
  if (!match) return { frontmatter: {}, body: content, hasFrontmatter: false };

  let parsed: unknown = {};
  try {
    parsed = parse(match[1] ?? '');
  } catch {}

  return {
    frontmatter: isRecord(parsed) ? parsed : {},
    body: content.slice(match[0].length),
    hasFrontmatter: true
  };
};
