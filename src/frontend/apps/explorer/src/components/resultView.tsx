import { Flex, Select, Text, theme } from '@metorial/ui';
import type {
  CompatibilityCallToolResult,
  GetPromptResult,
  ReadResourceResult
} from '@modelcontextprotocol/sdk/types.js';
import { Fragment, useState } from 'react';
import styled from 'styled-components';

let cssValue = (value: string) => String(value);

let ResultShell = styled.div<{ $error?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px;
  border-radius: 8px;
  border: 1px solid
    ${({ $error }) =>
      $error ? cssValue(theme.colors.red600) : cssValue(theme.colors.gray400)};
  background: ${({ $error }) =>
    $error ? cssValue(theme.colors.red100) : cssValue(theme.colors.gray100)};
`;

let Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let SectionTitle = styled.div`
  font-size: 12px;
  font-weight: 700;
  color: ${cssValue(theme.colors.gray800)};
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

let DataBlock = styled.pre<{ $error?: boolean }>`
  margin: 0;
  padding: 12px 14px;
  border-radius: 8px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
  background: ${({ $error }) =>
    $error ? cssValue(theme.colors.red200) : cssValue(theme.colors.white100)};
  border: 1px solid
    ${({ $error }) =>
      $error ? cssValue(theme.colors.red600) : cssValue(theme.colors.gray300)};
  color: ${({ $error }) =>
    $error ? cssValue(theme.colors.red900) : cssValue(theme.colors.gray900)};
`;

let MessageCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid ${cssValue(theme.colors.gray300)};
  background: ${cssValue(theme.colors.white100)};
`;

let MetaLine = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: ${cssValue(theme.colors.gray700)};
`;

let Media = styled.img`
  width: 100%;
  max-width: 440px;
  border-radius: 8px;
  border: 1px solid ${cssValue(theme.colors.gray300)};
  background: ${cssValue(theme.colors.white100)};
`;

let JsonLine = styled.div`
  display: block;
  white-space: pre;
`;

let JsonKey = styled.span`
  color: ${cssValue(theme.colors.blue900)};
`;

let JsonString = styled.span`
  color: ${cssValue(theme.colors.green900)};
`;

let JsonNumber = styled.span`
  color: ${cssValue(theme.colors.orange700)};
`;

let JsonBoolean = styled.span`
  color: #8b5cf6;
`;

let JsonNull = styled.span`
  color: ${cssValue(theme.colors.red700)};
`;

let JsonPunctuation = styled.span`
  color: ${cssValue(theme.colors.gray700)};
`;

let formatJson = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

let isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

let tryParseJsonString = (value: string) => {
  try {
    return {
      ok: true as const,
      value: JSON.parse(value)
    };
  } catch {
    return {
      ok: false as const,
      value: null
    };
  }
};

let renderJsonStringValue = (value: string) => {
  let parts = value.split('\n');

  if (parts.length === 1) {
    return <JsonString>{JSON.stringify(value)}</JsonString>;
  }

  return (
    <JsonString>
      &quot;
      {parts.map((part, index) => (
        <Fragment key={`json-string-line-${index}`}>
          {part}
          {index < parts.length - 1 ? '\n' : null}
        </Fragment>
      ))}
      &quot;
    </JsonString>
  );
};

let renderJsonPrimitive = (value: unknown) => {
  if (typeof value === 'string') {
    return renderJsonStringValue(value);
  }

  if (typeof value === 'number') {
    return <JsonNumber>{String(value)}</JsonNumber>;
  }

  if (typeof value === 'boolean') {
    return <JsonBoolean>{String(value)}</JsonBoolean>;
  }

  if (value === null) {
    return <JsonNull>null</JsonNull>;
  }

  return <JsonString>{JSON.stringify(value)}</JsonString>;
};

let renderJsonBlock = (
  value: unknown,
  depth = 0,
  trailingComma = false,
  propertyKey?: string,
  nodeKey = 'root'
): React.ReactNode => {
  let indent = '  '.repeat(depth);
  let keyPrefix =
    propertyKey !== undefined ? (
      <>
        <JsonKey>{JSON.stringify(propertyKey)}</JsonKey>
        <JsonPunctuation>: </JsonPunctuation>
      </>
    ) : null;

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <JsonLine key={nodeKey}>
          {indent}
          {keyPrefix}
          <JsonPunctuation>[]</JsonPunctuation>
          {trailingComma ? <JsonPunctuation>,</JsonPunctuation> : null}
        </JsonLine>
      );
    }

    return (
      <Fragment key={nodeKey}>
        <JsonLine>
          {indent}
          {keyPrefix}
          <JsonPunctuation>[</JsonPunctuation>
        </JsonLine>
        {value.map((item, index) =>
          renderJsonBlock(
            item,
            depth + 1,
            index < value.length - 1,
            undefined,
            `${nodeKey}-${index}`
          )
        )}
        <JsonLine>
          {indent}
          <JsonPunctuation>]</JsonPunctuation>
          {trailingComma ? <JsonPunctuation>,</JsonPunctuation> : null}
        </JsonLine>
      </Fragment>
    );
  }

  if (isObject(value)) {
    let entries = Object.entries(value);

    if (entries.length === 0) {
      return (
        <JsonLine key={nodeKey}>
          {indent}
          {keyPrefix}
          <JsonPunctuation>{'{}'}</JsonPunctuation>
          {trailingComma ? <JsonPunctuation>,</JsonPunctuation> : null}
        </JsonLine>
      );
    }

    return (
      <Fragment key={nodeKey}>
        <JsonLine>
          {indent}
          {keyPrefix}
          <JsonPunctuation>{'{'}</JsonPunctuation>
        </JsonLine>
        {entries.map(([entryKey, entryValue], index) =>
          renderJsonBlock(
            entryValue,
            depth + 1,
            index < entries.length - 1,
            entryKey,
            `${nodeKey}-${entryKey}`
          )
        )}
        <JsonLine>
          {indent}
          <JsonPunctuation>{'}'}</JsonPunctuation>
          {trailingComma ? <JsonPunctuation>,</JsonPunctuation> : null}
        </JsonLine>
      </Fragment>
    );
  }

  return (
    <JsonLine key={nodeKey}>
      {indent}
      {keyPrefix}
      {renderJsonPrimitive(value)}
      {trailingComma ? <JsonPunctuation>,</JsonPunctuation> : null}
    </JsonLine>
  );
};

let renderJsonViewer = (value: unknown, error = false) => (
  <DataBlock $error={error}>{renderJsonBlock(value)}</DataBlock>
);

let renderTextOrJson = (value: unknown, error = false) => {
  if (typeof value === 'string') {
    let parsed = tryParseJsonString(value);
    return parsed.ok ? (
      renderJsonViewer(parsed.value, error)
    ) : (
      <DataBlock $error={error}>{value}</DataBlock>
    );
  }

  return renderJsonViewer(value, error);
};

let renderBlob = (mimeType: string | undefined, blob: string | undefined, error = false) => {
  if (!blob) return renderTextOrJson({ mimeType, blob }, error);

  if (mimeType?.startsWith('image/')) {
    return <Media src={`data:${mimeType};base64,${blob}`} alt="MCP result" />;
  }

  if (mimeType?.startsWith('audio/')) {
    return <audio controls src={`data:${mimeType};base64,${blob}`} />;
  }

  return renderTextOrJson({ mimeType, blob }, error);
};

let renderContentBlock = (item: any, index: number, error = false) => {
  if (!item) return null;

  if (item.type === 'text') {
    return <div key={index}>{renderTextOrJson(item.text, error)}</div>;
  }

  if (item.type === 'image') {
    return (
      <Section key={index}>
        <MetaLine>
          <span>Image</span>
          {item.mimeType ? <span>{item.mimeType}</span> : null}
        </MetaLine>
        <Media src={`data:${item.mimeType};base64,${item.data}`} alt="Tool image result" />
      </Section>
    );
  }

  if (item.type === 'resource' && item.resource) {
    return (
      <Section key={index}>
        <MetaLine>
          <span>Embedded Resource</span>
          {item.resource.uri ? <span>{item.resource.uri}</span> : null}
          {item.resource.mimeType ? <span>{item.resource.mimeType}</span> : null}
        </MetaLine>
        {'text' in item.resource && item.resource.text !== undefined
          ? renderTextOrJson(item.resource.text, error)
          : renderBlob(item.resource.mimeType, item.resource.blob, error)}
      </Section>
    );
  }

  return <div key={index}>{renderTextOrJson(item, error)}</div>;
};

let renderResourceEntry = (item: any, index: number) => (
  <MessageCard key={index}>
    <MetaLine>
      {item.uri ? <span>{item.uri}</span> : null}
      {item.mimeType ? <span>{item.mimeType}</span> : null}
    </MetaLine>
    {'text' in item && item.text !== undefined
      ? renderTextOrJson(item.text)
      : renderBlob(item.mimeType, item.blob)}
  </MessageCard>
);

let renderPromptContent = (content: any, index: number) => {
  if (Array.isArray(content)) {
    return (
      <Section key={index}>
        {content.map((item, itemIndex) => renderContentBlock(item, itemIndex))}
      </Section>
    );
  }

  if (content?.type) {
    return renderContentBlock(content, index);
  }

  return <div key={index}>{renderTextOrJson(content)}</div>;
};

export let ToolResultView = ({ result }: { result: CompatibilityCallToolResult }) => {
  let isError = 'isError' in result && Boolean(result.isError);
  let content = 'content' in result ? result.content : undefined;
  let contentItems = Array.isArray(content) ? content : null;
  let structuredContent = 'structuredContent' in result ? result.structuredContent : undefined;
  let legacyToolResult = 'toolResult' in result ? result.toolResult : undefined;
  let hasContent = contentItems !== null && contentItems.length > 0;
  let hasStructuredContent = structuredContent !== undefined;
  let hasBothViews = hasContent && hasStructuredContent;
  let [selectedView, setSelectedView] = useState<'content' | 'structured'>('content');

  return (
    <ResultShell $error={isError}>
      {isError ? (
        <Text as="div" size="2" weight="strong" color="red700">
          Tool returned an error
        </Text>
      ) : (
        <Flex align="center" justify="space-between">
          <Text as="div" size="2" weight="strong" color="green900">
            Tool result
          </Text>

          {hasBothViews && (
            <Select
              label="Result View"
              value={selectedView}
              hideLabel
              size="1"
              onChange={value =>
                setSelectedView((value as 'content' | 'structured') ?? 'content')
              }
              items={[
                { id: 'content', label: 'Content' },
                { id: 'structured', label: 'Structured Content' }
              ]}
            />
          )}
        </Flex>
      )}

      {hasContent && (!hasBothViews || selectedView === 'content') ? (
        <Section>
          <SectionTitle>Content</SectionTitle>
          {contentItems?.map((item, index) => renderContentBlock(item, index, isError))}
        </Section>
      ) : null}

      {hasStructuredContent && (!hasBothViews || selectedView === 'structured') ? (
        <Section>
          <SectionTitle>Structured Content</SectionTitle>
          {renderTextOrJson(structuredContent, isError)}
        </Section>
      ) : null}

      {legacyToolResult !== undefined ? (
        <Section>
          <SectionTitle>Legacy Result</SectionTitle>
          {renderTextOrJson(legacyToolResult, isError)}
        </Section>
      ) : null}
    </ResultShell>
  );
};

export let ResourceResultView = ({ result }: { result: ReadResourceResult }) => (
  <ResultShell>
    <Text as="div" size="2" weight="strong">
      Resource result
    </Text>

    {(result.contents ?? []).map((item, index) => renderResourceEntry(item, index))}
  </ResultShell>
);

export let PromptResultView = ({ result }: { result: GetPromptResult }) => (
  <ResultShell>
    <Text as="div" size="2" weight="strong">
      Prompt result
    </Text>

    {result.description ? (
      <Section>
        <SectionTitle>Description</SectionTitle>
        <Text size="2" color="gray700">
          {result.description}
        </Text>
      </Section>
    ) : null}

    {(result.messages ?? []).map((message: any, index: number) => (
      <MessageCard key={index}>
        <MetaLine>
          <span>Role: {message.role ?? 'unknown'}</span>
        </MetaLine>
        {renderPromptContent(message.content, index)}
      </MessageCard>
    ))}
  </ResultShell>
);
