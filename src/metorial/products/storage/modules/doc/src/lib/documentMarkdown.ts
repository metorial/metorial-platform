import { composeFullMarkdown } from '@metorial/docs-editor-schema';

let splitFrontMatter = (content: string) => {
  let input = content.replace(/^\uFEFF/, '');
  let match = input.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\r?\n?/);
  if (!match) return { frontMatter: undefined, body: input };

  return {
    frontMatter: (match[1] ?? '').trim(),
    body: input.slice(match[0].length)
  };
};

let stripLeadingTitle = (body: string) => {
  let match = body.match(/^\s*#\s+[^\r\n]+(?:\r?\n|$)/);
  if (!match) return body;

  return body.slice(match[0].length).replace(/^\s+/, '');
};

export let rewriteDocumentMarkdownTitle = (content: string, title: string) => {
  let { frontMatter, body } = splitFrontMatter(content);

  return composeFullMarkdown({
    frontMatter,
    title,
    body: stripLeadingTitle(body)
  });
};
