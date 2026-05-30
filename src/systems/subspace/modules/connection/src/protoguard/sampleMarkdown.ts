import { SAMPLE_BUFFER_LINES } from './config';

let escapeMarkdownHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

let getLineBounds = (content: string, startOffset: number, endOffset: number) => {
  let lines = content.split('\n');
  let cursor = 0;
  let startLine = 0;
  let endLine = 0;

  for (let i = 0; i < lines.length; i++) {
    let lineEnd = cursor + lines[i]!.length;

    if (startOffset >= cursor && startOffset <= lineEnd) startLine = i;
    if (endOffset >= cursor && endOffset <= lineEnd + 1) {
      endLine = i;
      break;
    }

    cursor = lineEnd + 1;
  }

  return {
    lines,
    fromLine: Math.max(0, startLine - SAMPLE_BUFFER_LINES),
    toLine: Math.min(lines.length - 1, endLine + SAMPLE_BUFFER_LINES)
  };
};

export let createProtoGuardSampleMarkdown = (d: {
  path: string;
  content: string;
  startOffset: number;
  endOffset: number;
}) => {
  let { lines, fromLine, toLine } = getLineBounds(d.content, d.startOffset, d.endOffset);
  let sampleStartOffset = lines
    .slice(0, fromLine)
    .reduce((sum, line) => sum + line.length + 1, 0);
  let sampleContent = lines.slice(fromLine, toLine + 1).join('\n');
  let relativeStart = Math.max(0, d.startOffset - sampleStartOffset);
  let relativeEnd = Math.max(relativeStart, d.endOffset - sampleStartOffset);

  let before = sampleContent.slice(0, relativeStart);
  let match = sampleContent.slice(relativeStart, relativeEnd);
  let after = sampleContent.slice(relativeEnd);

  return [
    `**${escapeMarkdownHtml(d.path)}**`,
    '',
    `${escapeMarkdownHtml(before)}<mark>${escapeMarkdownHtml(match)}</mark>${escapeMarkdownHtml(after)}`
  ].join('\n');
};
