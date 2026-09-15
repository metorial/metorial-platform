import type { ChatMessage } from '@metorial/state';
import { Text, theme } from '@metorial/ui';
import { RiAttachment2, RiExternalLinkLine } from '@remixicon/react';
import ReactMarkdown from 'react-markdown';
import styled from 'styled-components';

let Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

let MarkdownShell = styled.div`
  color: ${theme.colors.gray900};
  font-size: 14px;
  line-height: 21px;
  word-break: break-word;

  p,
  ul,
  ol,
  blockquote,
  pre {
    margin: 0;
  }

  p + p,
  p + ul,
  p + ol,
  p + blockquote,
  p + pre,
  ul + p,
  ol + p,
  blockquote + p,
  pre + p {
    margin-top: 6px;
  }

  ul,
  ol {
    padding-left: 20px;
  }

  ul {
    list-style: disc;
  }

  ol {
    list-style: decimal;
  }

  li + li {
    margin-top: 2px;
  }

  h1,
  h2,
  h3,
  h4,
  h5,
  h6 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: ${theme.colors.gray900};
  }

  blockquote {
    padding-left: 10px;
    border-left: 3px solid ${theme.colors.gray400};
    color: ${theme.colors.gray700};
  }

  a {
    color: ${theme.colors.blue900};
    text-decoration: none;

    &:hover {
      text-decoration: underline;
    }
  }

  code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 12.5px;
    background: ${theme.colors.gray200};
    border: 1px solid ${theme.colors.gray300};
    border-radius: 4px;
    padding: 1px 4px;
  }

  pre {
    background: ${theme.colors.gray200};
    border: 1px solid ${theme.colors.gray300};
    border-radius: 6px;
    padding: 10px;
    overflow-x: auto;
  }

  pre code {
    background: none;
    border: none;
    padding: 0;
  }

  img {
    max-width: 100%;
    border-radius: 6px;
  }
`;

let Divider = styled.hr`
  border: none;
  border-top: 1px solid ${theme.colors.gray300};
  margin: 4px 0;
  width: 100%;
`;

let Card = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: ${theme.colors.gray100};
`;

let Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

let Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px 16px;
`;

let TableWrapper = styled.div`
  overflow-x: auto;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;

  table {
    border-collapse: collapse;
    width: 100%;
    font-size: 13px;
  }

  th,
  td {
    text-align: left;
    padding: 6px 10px;
    border-bottom: 1px solid ${theme.colors.gray300};
    white-space: nowrap;
  }

  th {
    font-weight: 500;
    color: ${theme.colors.gray700};
    background: ${theme.colors.gray150};
  }

  tr:last-child td {
    border-bottom: none;
  }
`;

let Chart = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  padding: 10px 12px;
`;

let ChartRow = styled.div`
  display: grid;
  grid-template-columns: minmax(70px, 140px) 1fr auto;
  align-items: center;
  gap: 10px;
`;

let ChartTrack = styled.div`
  height: 6px;
  border-radius: 3px;
  background: ${theme.colors.gray300};
  overflow: hidden;
`;

let ChartFill = styled.div`
  height: 100%;
  border-radius: 3px;
  background: ${theme.colors.gray700};
`;

let Unfurl = styled.a`
  display: flex;
  gap: 10px;
  border: 1px solid ${theme.colors.gray300};
  border-left: 3px solid ${theme.colors.gray500};
  border-radius: 6px;
  padding: 8px 10px;
  text-decoration: none;
  max-width: 460px;

  &:hover {
    background: ${theme.colors.gray150};
  }

  img {
    height: 44px;
    width: 44px;
    object-fit: cover;
    border-radius: 4px;
  }
`;

let Attachment = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 6px;
  padding: 6px 10px;
  text-decoration: none;
  color: ${theme.colors.gray800};
  font-size: 13px;
  max-width: 320px;

  &:hover {
    background: ${theme.colors.gray150};
  }

  svg {
    height: 14px;
    width: 14px;
    flex-shrink: 0;
  }
`;

let AttachmentImage = styled.img`
  max-width: 340px;
  max-height: 260px;
  border-radius: 8px;
  border: 1px solid ${theme.colors.gray300};
  display: block;
`;

let Attachments = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`;

let InlineImage = styled.img`
  max-width: 340px;
  max-height: 260px;
  border-radius: 8px;
  display: block;
`;

let Link = styled.a`
  color: ${theme.colors.blue900};
  font-size: 14px;
  text-decoration: none;
  width: fit-content;

  &:hover {
    text-decoration: underline;
  }
`;

let Deleted = styled.div`
  font-size: 14px;
  font-style: italic;
  color: ${theme.colors.gray600};
`;

type ChatPart = Record<string, any>;

let textStyles: Record<
  string,
  { weight: 'regular' | 'strong'; color: 'gray900' | 'gray600' }
> = {
  plain: { weight: 'regular', color: 'gray900' },
  bold: { weight: 'strong', color: 'gray900' },
  muted: { weight: 'regular', color: 'gray600' }
};

let ChartPart = ({ part }: { part: ChatPart }) => {
  let chart = part.chart ?? {};

  let rows: { label: string; value: number }[] =
    chart.type == 'pie'
      ? (chart.segments ?? [])
      : (chart.series ?? []).flatMap((series: any) =>
          (series.data ?? []).map((point: any) => ({
            label:
              (chart.series ?? []).length > 1
                ? `${series.name} · ${point.label}`
                : point.label,
            value: point.value
          }))
        );

  let max = rows.reduce((highest, row) => Math.max(highest, row.value ?? 0), 0);

  return (
    <Chart>
      <Text size="2" weight="strong">
        {part.title}
      </Text>

      {rows.map((row, index) => (
        <ChartRow key={index}>
          <Text size="1" color="gray700">
            {row.label}
          </Text>
          <ChartTrack>
            <ChartFill
              style={{ width: `${max > 0 ? Math.max((row.value / max) * 100, 2) : 0}%` }}
            />
          </ChartTrack>
          <Text size="1" color="gray700">
            {row.value}
          </Text>
        </ChartRow>
      ))}
    </Chart>
  );
};

let Part = ({ part }: { part: ChatPart }) => {
  if (!part || typeof part != 'object') return null;

  switch (part.type) {
    case 'markdown':
      return (
        <MarkdownShell>
          <ReactMarkdown skipHtml>{part.markdown ?? ''}</ReactMarkdown>
        </MarkdownShell>
      );

    case 'text': {
      // Older stored bodies used `text` where the current schema uses `content`.
      let content = part.content ?? part.text ?? '';
      let style = textStyles[part.style as string] ?? textStyles.plain;

      return (
        <Text
          size="2"
          weight={style.weight}
          color={style.color}
          style={{ whiteSpace: 'pre-wrap' }}
        >
          {content}
        </Text>
      );
    }

    case 'image':
      return <InlineImage src={part.url} alt={part.alt ?? ''} />;

    case 'divider':
      return <Divider />;

    case 'link':
      return (
        <Link href={part.url} target="_blank" rel="noreferrer">
          {part.label ?? part.url}
        </Link>
      );

    case 'fields':
      return (
        <Fields>
          {(part.children ?? []).map((field: ChatPart, index: number) => (
            <div key={index}>
              <Text size="1" color="gray600">
                {field.label}
              </Text>
              <Text size="2" color="gray900">
                {field.value}
              </Text>
            </div>
          ))}
        </Fields>
      );

    case 'table':
      return (
        <div>
          <TableWrapper>
            <table>
              <thead>
                <tr>
                  {(part.headers ?? []).map((header: string, index: number) => (
                    <th key={index} style={{ textAlign: part.align?.[index] ?? 'left' }}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(part.rows ?? []).map((row: string[], rowIndex: number) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td
                        key={cellIndex}
                        style={{ textAlign: part.align?.[cellIndex] ?? 'left' }}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrapper>

          {part.caption && (
            <Text size="1" color="gray600" style={{ marginTop: 4 }}>
              {part.caption}
            </Text>
          )}
        </div>
      );

    case 'chart':
      return <ChartPart part={part} />;

    case 'section':
      return (
        <Section>
          {(part.children ?? []).map((child: ChatPart, index: number) => (
            <Part key={index} part={child} />
          ))}
        </Section>
      );

    case 'card':
      return (
        <Card>
          {part.title && (
            <Text size="2" weight="strong">
              {part.title}
            </Text>
          )}
          {part.subtitle && (
            <Text size="1" color="gray600">
              {part.subtitle}
            </Text>
          )}
          {part.imageUrl && <InlineImage src={part.imageUrl} alt="" />}
          {(part.children ?? []).map((child: ChatPart, index: number) => (
            <Part key={index} part={child} />
          ))}
        </Card>
      );

    default:
      return null;
  }
};

let formatFileSize = (size: number | null) => {
  if (!size) return null;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

export let ChatMessageBody = ({ message }: { message: ChatMessage }) => {
  let parts = (message.body?.parts ?? []) as ChatPart[];
  let hasContent = parts.length > 0 || message.attachments.length > 0;

  if (message.deletedAt || !hasContent) {
    return <Deleted>This message was deleted.</Deleted>;
  }

  return (
    <Body>
      {parts.map((part, index) => (
        <Part key={index} part={part} />
      ))}

      {message.attachments.length > 0 && (
        <Attachments>
          {message.attachments.map(attachment => {
            let size = formatFileSize(attachment.size);
            let isImage =
              attachment.type == 'image' || attachment.mimeType?.startsWith('image/');

            if (isImage && attachment.downloadUrl) {
              return (
                <a
                  key={attachment.id}
                  href={attachment.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <AttachmentImage src={attachment.downloadUrl} alt={attachment.name ?? ''} />
                </a>
              );
            }

            return (
              <Attachment
                key={attachment.id}
                href={attachment.downloadUrl ?? '#'}
                target="_blank"
                rel="noreferrer"
              >
                <RiAttachment2 />
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {attachment.name ?? 'Attachment'}
                </span>
                {size && <span style={{ color: theme.colors.gray600 }}>{size}</span>}
              </Attachment>
            );
          })}
        </Attachments>
      )}

      {(message.unfurls ?? []).map((unfurl, index) => (
        <Unfurl key={index} href={unfurl.url} target="_blank" rel="noreferrer">
          {unfurl.imageUrl && <img src={unfurl.imageUrl} alt="" />}

          <div style={{ minWidth: 0 }}>
            <Text size="1" color="gray600">
              {unfurl.siteName ?? new URL(unfurl.url).hostname}
            </Text>
            <Text size="2" weight="medium" color="gray900">
              {unfurl.title ?? unfurl.url}
            </Text>
            {unfurl.description && (
              <Text size="1" color="gray700">
                {unfurl.description}
              </Text>
            )}
          </div>

          <RiExternalLinkLine size={14} color={theme.colors.gray600} />
        </Unfurl>
      ))}
    </Body>
  );
};
