import { Badge, Panel, Text, showModal, theme } from '@metorial/ui';
import { Fragment, type ReactNode } from 'react';
import styled from 'styled-components';
import { JsonViewer } from '../../../../../components/jsonViewer';
import { asRecord, isPresentJsonValue } from '../utils';

type CapabilityKind = 'tool' | 'prompt' | 'resource' | 'resourceTemplate';

let kindLabel: Record<CapabilityKind, string> = {
  tool: 'Tool',
  prompt: 'Prompt',
  resource: 'Resource',
  resourceTemplate: 'Resource Template'
};

let SectionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

let Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

let SectionHeading = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.gray700};

  letter-spacing: 0.03em;
`;

let MetaGrid = styled.dl`
  display: grid;
  grid-template-columns: minmax(120px, max-content) 1fr;
  gap: 6px 16px;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.gray100};
  font-size: 12px;
`;

let MetaKey = styled.dt`
  color: ${theme.colors.gray700};
  font-weight: 500;
`;

let MetaValue = styled.dd`
  margin: 0;
  color: ${theme.colors.gray900};
  word-break: break-word;
`;

let CodeValue = styled.code`
  font-family:
    'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray800};
  border: 1px solid ${theme.colors.gray300};
`;

let ArgumentCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.background};
`;

let ArgumentRow = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
`;

let JsonWrapper = styled.div`
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  padding: 10px;
  background: ${theme.colors.gray100};
  max-height: 420px;
  overflow: auto;
`;

let safeString = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'string') return value.length > 0 ? value : null;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
};

let formatBytes = (value: unknown): string | null => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  if (value < 1024) return `${value} B`;
  let kb = value / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  let mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
};

let formatDateMaybe = (value: unknown): string | null => {
  let str = safeString(value);
  if (!str) return null;
  let date = new Date(str);
  if (Number.isNaN(date.getTime())) return str;
  return `${str} (${date.toLocaleString()})`;
};

type MetaEntry = { label: string; value: ReactNode };

let renderMeta = (entries: MetaEntry[]) => {
  if (entries.length === 0) return null;
  return (
    <MetaGrid>
      {entries.map((entry, idx) => (
        <Fragment key={`${idx}-${entry.label}`}>
          <MetaKey>{entry.label}</MetaKey>
          <MetaValue>{entry.value}</MetaValue>
        </Fragment>
      ))}
    </MetaGrid>
  );
};

let renderAnnotations = (annotations: unknown): ReactNode => {
  let record = asRecord(annotations);
  if (!record) return null;

  let entries: MetaEntry[] = [];

  if (Array.isArray(record.audience) && record.audience.length > 0) {
    entries.push({
      label: 'Audience',
      value: (
        <ArgumentRow>
          {record.audience.map((value: unknown, idx: number) => {
            let label = safeString(value);
            if (!label) return null;
            return (
              <Badge key={`${label}-${idx}`} color="gray" size="1">
                {label}
              </Badge>
            );
          })}
        </ArgumentRow>
      )
    });
  }

  let priority = record.priority;
  if (typeof priority === 'number' && Number.isFinite(priority)) {
    entries.push({ label: 'Priority', value: String(priority) });
  }

  let lastModified = formatDateMaybe(record.lastModified);
  if (lastModified) {
    entries.push({ label: 'Last Modified', value: lastModified });
  }

  let hintEntries: { key: string; label: string }[] = [
    { key: 'readOnlyHint', label: 'Read-only' },
    { key: 'destructiveHint', label: 'Destructive' },
    { key: 'idempotentHint', label: 'Idempotent' },
    { key: 'openWorldHint', label: 'Open-world' }
  ];

  let hints: ReactNode[] = [];
  for (let { key, label } of hintEntries) {
    let value = record[key];
    if (typeof value !== 'boolean') continue;
    hints.push(
      <Badge key={key} color={value ? 'blue' : 'gray'} size="1">
        {label}: {value ? 'yes' : 'no'}
      </Badge>
    );
  }

  if (hints.length > 0) {
    entries.push({ label: 'Hints', value: <ArgumentRow>{hints}</ArgumentRow> });
  }

  let annotationTitle = safeString(record.title);
  if (annotationTitle) {
    entries.push({ label: 'Annotation Title', value: annotationTitle });
  }

  if (entries.length === 0) return null;
  return renderMeta(entries);
};

let renderToolDetails = (tool: Record<string, any>): ReactNode[] => {
  let sections: ReactNode[] = [];

  let metaEntries: MetaEntry[] = [];
  let name = safeString(tool.name);
  let title = safeString(tool.title);
  if (name) metaEntries.push({ label: 'Name', value: <CodeValue>{name}</CodeValue> });
  if (title && title !== name) metaEntries.push({ label: 'Title', value: title });

  if (metaEntries.length > 0) {
    sections.push(
      <Section key="identity">
        <SectionHeading>Identity</SectionHeading>
        {renderMeta(metaEntries)}
      </Section>
    );
  }

  let annotations = renderAnnotations(tool.annotations);
  if (annotations) {
    sections.push(
      <Section key="annotations">
        <SectionHeading>Annotations</SectionHeading>
        {annotations}
      </Section>
    );
  }

  if (isPresentJsonValue(tool.inputSchema)) {
    sections.push(
      <Section key="inputSchema">
        <SectionHeading>Input Schema</SectionHeading>
        <JsonWrapper>
          <JsonViewer value={tool.inputSchema} />
        </JsonWrapper>
      </Section>
    );
  }

  if (isPresentJsonValue(tool.outputSchema)) {
    sections.push(
      <Section key="outputSchema">
        <SectionHeading>Output Schema</SectionHeading>
        <JsonWrapper>
          <JsonViewer value={tool.outputSchema} />
        </JsonWrapper>
      </Section>
    );
  }

  return sections;
};

let renderPromptDetails = (prompt: Record<string, any>): ReactNode[] => {
  let sections: ReactNode[] = [];

  let metaEntries: MetaEntry[] = [];
  let name = safeString(prompt.name);
  let title = safeString(prompt.title);
  if (name) metaEntries.push({ label: 'Name', value: <CodeValue>{name}</CodeValue> });
  if (title && title !== name) metaEntries.push({ label: 'Title', value: title });

  if (metaEntries.length > 0) {
    sections.push(
      <Section key="identity">
        <SectionHeading>Identity</SectionHeading>
        {renderMeta(metaEntries)}
      </Section>
    );
  }

  let args = Array.isArray(prompt.arguments) ? prompt.arguments : [];
  if (args.length > 0) {
    sections.push(
      <Section key="arguments">
        <SectionHeading>Arguments</SectionHeading>
        <SectionList>
          {args.map((arg: unknown, idx: number) => {
            let record = asRecord(arg);
            if (!record) return null;
            let argName = safeString(record.name) ?? `Argument ${idx + 1}`;
            let argTitle = safeString(record.title);
            let argDescription = safeString(record.description);
            let required = record.required === true;

            return (
              <ArgumentCard key={`${argName}-${idx}`}>
                <ArgumentRow>
                  <CodeValue>{argName}</CodeValue>
                  {argTitle && argTitle !== argName ? (
                    <Text size="2" color="gray700">
                      {argTitle}
                    </Text>
                  ) : null}
                  <Badge color={required ? 'blue' : 'gray'} size="1">
                    {required ? 'required' : 'optional'}
                  </Badge>
                </ArgumentRow>
                {argDescription ? (
                  <Text size="2" color="gray700">
                    {argDescription}
                  </Text>
                ) : null}
              </ArgumentCard>
            );
          })}
        </SectionList>
      </Section>
    );
  }

  return sections;
};

let renderResourceDetails = (resource: Record<string, any>): ReactNode[] => {
  let sections: ReactNode[] = [];

  let metaEntries: MetaEntry[] = [];
  let name = safeString(resource.name);
  let title = safeString(resource.title);
  let uri = safeString(resource.uri);
  let mimeType = safeString(resource.mimeType);
  let size = formatBytes(resource.size);

  if (uri) metaEntries.push({ label: 'URI', value: <CodeValue>{uri}</CodeValue> });
  if (name) metaEntries.push({ label: 'Name', value: <CodeValue>{name}</CodeValue> });
  if (title && title !== name) metaEntries.push({ label: 'Title', value: title });
  if (mimeType)
    metaEntries.push({ label: 'MIME Type', value: <CodeValue>{mimeType}</CodeValue> });
  if (size) metaEntries.push({ label: 'Size', value: size });

  if (metaEntries.length > 0) {
    sections.push(
      <Section key="identity">
        <SectionHeading>Identity</SectionHeading>
        {renderMeta(metaEntries)}
      </Section>
    );
  }

  let annotations = renderAnnotations(resource.annotations);
  if (annotations) {
    sections.push(
      <Section key="annotations">
        <SectionHeading>Annotations</SectionHeading>
        {annotations}
      </Section>
    );
  }

  return sections;
};

let renderResourceTemplateDetails = (template: Record<string, any>): ReactNode[] => {
  let sections: ReactNode[] = [];

  let metaEntries: MetaEntry[] = [];
  let name = safeString(template.name);
  let title = safeString(template.title);
  let uriTemplate = safeString(template.uriTemplate);
  let mimeType = safeString(template.mimeType);

  if (uriTemplate) {
    metaEntries.push({ label: 'URI Template', value: <CodeValue>{uriTemplate}</CodeValue> });
  }
  if (name) metaEntries.push({ label: 'Name', value: <CodeValue>{name}</CodeValue> });
  if (title && title !== name) metaEntries.push({ label: 'Title', value: title });
  if (mimeType)
    metaEntries.push({ label: 'MIME Type', value: <CodeValue>{mimeType}</CodeValue> });

  if (metaEntries.length > 0) {
    sections.push(
      <Section key="identity">
        <SectionHeading>Identity</SectionHeading>
        {renderMeta(metaEntries)}
      </Section>
    );
  }

  let annotations = renderAnnotations(template.annotations);
  if (annotations) {
    sections.push(
      <Section key="annotations">
        <SectionHeading>Annotations</SectionHeading>
        {annotations}
      </Section>
    );
  }

  return sections;
};

let renderCommonSections = (entity: Record<string, any>): ReactNode[] => {
  let sections: ReactNode[] = [];

  let meta = entity._meta;
  if (isPresentJsonValue(meta)) {
    sections.push(
      <Section key="_meta">
        <SectionHeading>Metadata (_meta)</SectionHeading>
        <JsonWrapper>
          <JsonViewer value={meta} />
        </JsonWrapper>
      </Section>
    );
  }

  return sections;
};

let getTitleAndSubtitle = (kind: CapabilityKind, entity: Record<string, any>) => {
  let name = safeString(entity.name);
  let title = safeString(entity.title);

  if (kind === 'resource') {
    let uri = safeString(entity.uri);
    let resolvedTitle = title ?? name ?? uri ?? kindLabel[kind];
    let subtitle = resolvedTitle === name ? null : (name ?? uri ?? null);
    return { title: resolvedTitle, subtitle };
  }

  if (kind === 'resourceTemplate') {
    let uriTemplate = safeString(entity.uriTemplate);
    let resolvedTitle = title ?? name ?? uriTemplate ?? kindLabel[kind];
    let subtitle = resolvedTitle === name ? null : (name ?? uriTemplate ?? null);
    return { title: resolvedTitle, subtitle };
  }

  let resolvedTitle = title ?? name ?? kindLabel[kind];
  let subtitle = resolvedTitle === name ? null : name;
  return { title: resolvedTitle, subtitle };
};

export let showCapabilityDetailsPanel = (p: { kind: CapabilityKind; entity: unknown }) => {
  let record = asRecord(p.entity) ?? {};
  let description = safeString(record.description);
  let { title, subtitle } = getTitleAndSubtitle(p.kind, record);

  let kindSpecificSections: ReactNode[] = [];
  if (p.kind === 'tool') kindSpecificSections = renderToolDetails(record);
  else if (p.kind === 'prompt') kindSpecificSections = renderPromptDetails(record);
  else if (p.kind === 'resource') kindSpecificSections = renderResourceDetails(record);
  else if (p.kind === 'resourceTemplate')
    kindSpecificSections = renderResourceTemplateDetails(record);

  let commonSections = renderCommonSections(record);

  showModal(({ dialogProps }) => (
    <Panel.Wrapper {...dialogProps} width={720}>
      <Panel.Header>
        <Panel.Title>{title}</Panel.Title>
        {subtitle ? <Panel.Description>{subtitle}</Panel.Description> : null}
      </Panel.Header>

      <Panel.Content>
        <SectionList>
          {description ? (
            <Section>
              <SectionHeading>Description</SectionHeading>
              <Text size="2" color="gray800" style={{ whiteSpace: 'pre-wrap' }}>
                {description}
              </Text>
            </Section>
          ) : null}

          {kindSpecificSections}
          {commonSections}
        </SectionList>
      </Panel.Content>
    </Panel.Wrapper>
  ));
};
