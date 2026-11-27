import { theme } from '@metorial/ui';
import ReactMarkdown from 'react-markdown';
import styled from 'styled-components';

let cssValue = (value: string) => String(value);

let trimSharedIndent = (lines: string[], startIndex = 0) => {
  let candidates = lines.slice(startIndex).filter(line => line.trim().length > 0);

  if (candidates.length === 0) {
    return lines;
  }

  let sharedIndent = candidates.reduce<number>((smallest, line) => {
    let indent = line.match(/^\s*/)?.[0].length ?? 0;
    return Math.min(smallest, indent);
  }, Number.POSITIVE_INFINITY);

  if (!Number.isFinite(sharedIndent) || sharedIndent <= 0) {
    return lines;
  }

  return lines.map((line, index) => {
    if (index < startIndex || line.trim().length === 0) {
      return line;
    }

    return line.slice(sharedIndent);
  });
};

let dedentMarkdown = (content: string) => {
  let normalized = content.replace(/\r\n/g, '\n').trim();
  let lines = trimSharedIndent(normalized.split('\n'));
  let firstNonEmptyIndex = lines.findIndex(line => line.trim().length > 0);

  if (firstNonEmptyIndex === -1) {
    return '';
  }

  return trimSharedIndent(lines, firstNonEmptyIndex + 1)
    .join('\n')
    .trim();
};

let MarkdownShell = styled.div`
  color: ${cssValue(theme.colors.gray700)};
  line-height: 1.55;

  p,
  ul,
  ol,
  li,
  blockquote {
    font-size: 12px;
    font-weight: 400;
  }

  ul {
    list-style: disc;
  }

  ol {
    list-style: decimal;
  }

  p,
  ul,
  ol,
  blockquote {
    margin: 0;
  }

  p + p,
  p + ul,
  p + ol,
  p + blockquote,
  ul + p,
  ol + p,
  blockquote + p,
  ul + ul,
  ol + ol,
  ul + ol,
  ol + ul {
    margin-top: 8px;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 0;
    font-size: 16px;
    font-weight: 700;
    line-height: 1.35;
    color: ${cssValue(theme.colors.gray900)};
  }

  h1 + p,
  h2 + p,
  h3 + p,
  h4 + p,
  h5 + p,
  h6 + p,
  h1 + ul,
  h2 + ul,
  h3 + ul,
  h4 + ul,
  h5 + ul,
  h6 + ul,
  h1 + ol,
  h2 + ol,
  h3 + ol,
  h4 + ol,
  h5 + ol,
  h6 + ol,
  h1 + blockquote,
  h2 + blockquote,
  h3 + blockquote,
  h4 + blockquote,
  h5 + blockquote,
  h6 + blockquote {
    margin-top: 8px;
  }

  ul,
  ol {
    padding-left: 18px;
  }

  li + li {
    margin-top: 4px;
  }

  blockquote {
    padding-left: 12px;
    border-left: 2px solid ${cssValue(theme.colors.gray400)};
    color: ${cssValue(theme.colors.gray800)};
  }

  a {
    color: ${cssValue(theme.colors.gray900)};
    text-decoration: underline;
  }

  code {
    font-size: 12px;
    font-weight: 400;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  pre {
    margin: 0;
    white-space: pre-wrap;
    font-size: 12px;
    font-weight: 400;
    font-family: inherit;
    color: inherit;
  }

  pre code {
    font-family: inherit;
  }
`;

let ImageUrl = styled.span`
  display: inline;
  font-size: 12px;
  font-weight: 400;
  color: ${cssValue(theme.colors.gray800)};
  word-break: break-all;
`;

export let MarkdownDescription = ({
  content,
  className
}: {
  content: string;
  className?: string;
}) => {
  let normalizedContent = dedentMarkdown(content);

  return (
    <MarkdownShell className={className}>
      <ReactMarkdown
        skipHtml
        disallowedElements={['table', 'thead', 'tbody', 'tr', 'th', 'td']}
        components={{
          img: ({ src }) => <ImageUrl>{src ?? ''}</ImageUrl>
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </MarkdownShell>
  );
};
