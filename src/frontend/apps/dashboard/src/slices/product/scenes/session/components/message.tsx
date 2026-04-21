import { CodeBlock } from '@metorial/code';
import { DashboardInstanceSessionsMessagesGetOutput } from '@metorial/dashboard-sdk';
import { Button, Checkbox, Entity, Menu, RenderDate, Text, theme } from '@metorial/ui';
import {
  RiArrowDownSLine,
  RiArrowRightSLine,
  RiChatQuoteLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiExchangeLine,
  RiFileListLine,
  RiFileTextLine,
  RiFolderLine,
  RiImageLine,
  RiLink,
  RiMusic2Line,
  RiServerLine,
  RiToolsLine,
  RiUser3Line,
  RiRobot2Line
} from '@remixicon/react';
import { AnimatePresence, motion } from 'framer-motion';
import { type ReactNode, useState } from 'react';
import styled from 'styled-components';
import { JsonViewer } from '../../../../../components/jsonViewer';
import { AggregatedMessages } from '../hooks/useAggregatedMessages';
import { Entry, EntryWrapper } from './entry';

let Output = styled.div`
  display: flex;

  &[data-position='server'] {
    justify-content: flex-end;
  }
`;

let Wrapper = styled.div`
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.08);
  border: 1px solid ${theme.colors.gray400};
  width: 100%;
  overflow: hidden;
  background: ${theme.colors.background};

  &[data-error='true'] {
    border-color: ${theme.colors.red600};
    background: ${theme.colors.red100};
    box-shadow: 0 0 10px rgba(229, 72, 77, 0.18);
  }
`;

let Header = styled.header`
  padding: 10px 12px 10px 10px;
  border-bottom: 1px solid ${theme.colors.gray400};
  font-size: 12px;
  font-weight: 500;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;

  [data-error='true'] & {
    border-bottom-color: ${theme.colors.red300};
    color: ${theme.colors.red800};
  }
`;

let HeaderSection = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

let HeaderActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
`;

let ID = styled.span`
  height: 18px;
  min-width: 18px;
  border-radius: 3px;
  background: ${theme.colors.gray300};
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 0px 3px;

  [data-error='true'] & {
    background: ${theme.colors.red300};
    color: ${theme.colors.red800};
  }
`;

let Title = styled.p`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
`;

let InlineCode = styled.code`
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
    monospace;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 4px;
  background: ${theme.colors.gray200};
  color: ${theme.colors.gray800};
  border: 1px solid ${theme.colors.gray300};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 320px;
  min-width: 0;
`;

let Main = styled.main`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let Sections = styled.div`
  display: flex;
  flex-direction: column;
`;

let Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 15px;

  &:not(:last-child) {
    border-bottom: 1px solid ${theme.colors.gray400};
  }

  [data-error='true'] &:not(:last-child) {
    border-bottom-color: ${theme.colors.red300};
  }
`;

let SectionHeader = styled.div`
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.gray700};
  text-transform: uppercase;
  letter-spacing: 0.03em;
`;

let EmptyState = styled.div`
  padding: 12px;
  border-radius: 10px;
  border: 1px dashed ${theme.colors.gray300};
  background: ${theme.colors.gray100};
`;

let ErrorSection = styled.div`
  padding: 10px 15px;
  background: ${theme.colors.red100};
  border-top: 1px solid ${theme.colors.red300};
  font-size: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

let ErrorRow = styled.div`
  display: flex;
  gap: 8px;
`;

let ErrorLabel = styled.span`
  font-weight: 600;
  color: ${theme.colors.red700};
  min-width: 60px;
  flex-shrink: 0;
`;

let ErrorValue = styled.span`
  color: ${theme.colors.red800};
  word-break: break-word;
`;

let GroupWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

let GroupTrigger = styled(EntryWrapper).attrs({
  as: 'button',
  type: 'button'
})`
  width: 100%;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  text-align: left;
  color: ${theme.colors.gray600};

  > span {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 10px;
  }
`;

let GroupTitle = styled.span`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  color: ${theme.colors.gray600};

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 500;
  }
`;

let GroupActions = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
  color: ${theme.colors.gray600};

  time {
    font-size: 13px;
  }
`;

let GroupContent = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-left: 30px;
`;

let AnimatedGroupContent = styled(motion.div)`
  overflow: hidden;
`;

let MessageStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let SummaryTitle = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  flex-wrap: wrap;

  strong {
    font-weight: 600;
    color: ${theme.colors.gray900};
  }
`;

let OverviewStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let OverviewList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let CapabilityList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let OverviewHint = styled.div`
  font-size: 12px;
  color: ${theme.colors.gray700};
`;

let OverviewEntityIcon = styled.div`
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: ${theme.colors.gray100};
  border: 1px solid ${theme.colors.gray300};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: ${theme.colors.gray700};

  svg {
    width: 16px;
    height: 16px;
  }
`;

let shorten = (id: string | number, length = 15) => {
  let s = String(id);
  if (s.length <= length) return s;
  return `${s.substring(0, length)}...`;
};

let explorerCapabilityMethods = new Set([
  'initialize',
  'notifications/initialized',
  'prompts/list',
  'resources/list',
  'resources/templates/list',
  'tools/list'
]);

let isPresentJsonValue = (value: any) => {
  if (value == null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value).length > 0;
  return true;
};

let asRecord = (value: unknown): Record<string, any> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, any>;
};

let formatRawJson = (value: unknown) => JSON.stringify(value, null, 2) ?? String(value);

let getMethodParams = (payload: Record<string, any> | null | undefined) =>
  asRecord(payload?.params);

let getMethodResult = (payload: Record<string, any> | null | undefined) =>
  asRecord(payload?.result);

let getDefaultSection = (
  payload: Record<string, any> | null | undefined,
  fallbackLabel: string
): { label: string; value: any } | null => {
  if (!payload) return null;

  if ('params' in payload && isPresentJsonValue(payload.params)) {
    return { label: 'Parameters', value: payload.params };
  }

  if ('result' in payload && isPresentJsonValue(payload.result)) {
    return { label: 'Result', value: payload.result };
  }

  let { id, jsonrpc, method, params, result, ...rest } = payload;

  if (isPresentJsonValue(rest)) {
    return { label: fallbackLabel, value: rest };
  }

  return null;
};

let getMessagePayload = (message: DashboardInstanceSessionsMessagesGetOutput) =>
  (message.input ?? message.output ?? {}) as Record<string, any>;

let getMessageTransportMeta = (message: DashboardInstanceSessionsMessagesGetOutput) =>
  (message.transport?.mcp ?? null) as {
    client?: Record<string, any> | null;
    server?: Record<string, any> | null;
  } | null;

let getDisplayName = (
  value: Record<string, any> | null | undefined,
  fallback: string,
  opts?: { preferName?: boolean }
) => {
  if (!value) return fallback;

  if (opts?.preferName) {
    return String(value.name ?? value.title ?? fallback);
  }

  return String(value.title ?? value.name ?? fallback);
};

let flattenCapabilityDetails = (value: unknown, prefix = ''): string[] => {
  if (value == null || value === false) return [];
  if (value === true) return prefix ? [prefix] : [];

  if (Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }

  let record = asRecord(value);
  if (!record) return prefix ? [prefix] : [];

  let entries = Object.entries(record);
  if (entries.length === 0) return [];

  return entries.flatMap(([key, next]) =>
    flattenCapabilityDetails(next, prefix ? `${prefix}.${key}` : key)
  );
};

let describeCapability = (value: unknown) => {
  let details = flattenCapabilityDetails(value);
  if (details.length === 0) return null;
  if (details.length <= 3) return details.join(', ');
  return `${details.slice(0, 3).join(', ')} +${details.length - 3} more`;
};

let pluralize = (count: number, singular: string, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

let getSchemaPropertyCount = (schema: unknown) => {
  let properties = asRecord(asRecord(schema)?.properties);
  return properties ? Object.keys(properties).length : 0;
};

let getSchemaRequiredCount = (schema: unknown) => {
  let required = asRecord(schema)?.required;
  return Array.isArray(required) ? required.length : 0;
};

export let getMessageMethod = (
  message: DashboardInstanceSessionsMessagesGetOutput,
  aggregatedMessages?: Map<string, AggregatedMessages>
) => {
  let transportMcp = message.transport?.mcp;
  let payload = getMessagePayload(message);
  let messageKey = String(payload.id ?? transportMcp?.id ?? message.id);
  let agg = aggregatedMessages?.get(messageKey);

  return (
    agg?.method ??
    (typeof message.input?.method === 'string'
      ? message.input.method
      : typeof payload.method === 'string'
        ? payload.method
        : undefined)
  );
};

export let isExplorerCapabilityMethod = (method?: string | null) =>
  !!method && explorerCapabilityMethods.has(method);

export let shouldRenderStandaloneMessage = (
  message: DashboardInstanceSessionsMessagesGetOutput,
  aggregatedMessages: Map<string, AggregatedMessages>
) => {
  let transportMcp = message.transport?.mcp;
  if (!transportMcp) return false;

  let payload = getMessagePayload(message);
  let messageKey = String(payload.id ?? transportMcp.id);
  let agg = aggregatedMessages.get(messageKey);

  return !(
    agg?.request &&
    agg?.response &&
    agg.response.id === message.id &&
    agg.request.id !== message.id
  );
};

type OverviewSection = {
  id: string;
  label?: string;
  content: ReactNode;
};

type EntityDetail = {
  label: string;
  value: ReactNode;
};

type MessagePresentation = {
  defaultViewMode?: 'overview' | 'properties' | 'raw';
  hideCard?: boolean;
  label: ReactNode;
  overviewSections?: OverviewSection[];
  summaryIcon: ReactNode;
  summaryText: ReactNode;
};

let CapabilityOverview = ({
  capabilities
}: {
  capabilities: Record<string, any> | null | undefined;
}) => {
  let items = Object.entries(capabilities ?? {}).map(([label, value]) => ({
    description: describeCapability(value),
    label
  }));

  if (items.length === 0) {
    return (
      <Text size="1" color="gray700">
        No capabilities declared.
      </Text>
    );
  }

  return (
    <CapabilityList>
      {items.map(item => (
        <Checkbox
          key={item.label}
          checked
          label={item.label}
          description={item.description}
          readOnly
        />
      ))}
    </CapabilityList>
  );
};

let IdentityOverview = ({
  fallbackTitle,
  icon,
  info
}: {
  fallbackTitle: string;
  icon: ReactNode;
  info: Record<string, any> | null | undefined;
}) => {
  let title = getDisplayName(info, fallbackTitle);
  let details = [
    info?.name ? { label: 'Name', value: String(info.name) } : null,
    info?.version ? { label: 'Version', value: String(info.version) } : null,
    info?.websiteUrl ? { label: 'Website', value: String(info.websiteUrl) } : null
  ].filter(Boolean) as EntityDetail[];

  return (
    <OverviewStack>
      <Entity.Wrapper>
        <Entity.Content>
          <Entity.Field
            title={title}
            prefix={<OverviewEntityIcon>{icon}</OverviewEntityIcon>}
          />
          {details.map(detail => (
            <Entity.Field key={detail.label} title={detail.label} value={detail.value} />
          ))}
        </Entity.Content>
      </Entity.Wrapper>
    </OverviewStack>
  );
};

let CatalogOverview = ({
  emptyText,
  icon,
  items,
  moreText
}: {
  emptyText: string;
  icon: ReactNode;
  items: {
    description?: string | null;
    details?: EntityDetail[];
    id: string;
    title: string;
  }[];
  moreText?: string | null;
}) => {
  if (items.length === 0) {
    return (
      <Text size="1" color="gray700">
        {emptyText}
      </Text>
    );
  }

  return (
    <OverviewStack>
      <OverviewList>
        {items.map(item => (
          <Entity.Wrapper key={item.id}>
            <Entity.Content>
              <Entity.Field
                title={item.title}
                description={item.description ?? undefined}
                prefix={<OverviewEntityIcon>{icon}</OverviewEntityIcon>}
              />
              {(item.details ?? []).map(detail => (
                <Entity.Field
                  key={`${item.id}-${detail.label}`}
                  title={detail.label}
                  value={detail.value}
                />
              ))}
            </Entity.Content>
          </Entity.Wrapper>
        ))}
      </OverviewList>

      {moreText ? <OverviewHint>{moreText}</OverviewHint> : null}
    </OverviewStack>
  );
};

let getInitializeOverviewSections = ({
  input,
  output,
  transportMeta
}: {
  input: Record<string, any> | null;
  output: Record<string, any> | null;
  transportMeta: ReturnType<typeof getMessageTransportMeta>;
}): OverviewSection[] => {
  let params = getMethodParams(input);
  let result = getMethodResult(output);
  let clientInfo = asRecord(params?.clientInfo) ?? transportMeta?.client ?? null;
  let serverInfo = asRecord(result?.serverInfo) ?? transportMeta?.server ?? null;
  let clientCapabilities = asRecord(params?.capabilities);
  let serverCapabilities = asRecord(result?.capabilities);
  let protocolDetails = [
    {
      label: 'Client Version',
      value: params?.protocolVersion ? String(params.protocolVersion) : 'Unknown'
    },
    {
      label: 'Negotiated Version',
      value: result?.protocolVersion ? String(result.protocolVersion) : 'Unknown'
    }
  ] satisfies EntityDetail[];

  return [
    {
      id: 'initialization-details',
      label: 'Initialization',
      content: (
        <OverviewStack>
          <Entity.Wrapper>
            <Entity.Content>
              {protocolDetails.map(detail => (
                <Entity.Field key={detail.label} title={detail.label} value={detail.value} />
              ))}
            </Entity.Content>
          </Entity.Wrapper>

          <IdentityOverview fallbackTitle="Client" icon={<RiToolsLine />} info={clientInfo} />
          <IdentityOverview fallbackTitle="Server" icon={<RiServerLine />} info={serverInfo} />
        </OverviewStack>
      )
    },
    {
      id: 'client-capabilities',
      label: 'Client Capabilities',
      content: <CapabilityOverview capabilities={clientCapabilities} />
    },
    {
      id: 'server-capabilities',
      label: 'Server Capabilities',
      content: <CapabilityOverview capabilities={serverCapabilities} />
    },
    ...(result?.instructions
      ? [
          {
            id: 'instructions',
            label: 'Server Instructions',
            content: (
              <Text size="1" color="gray800">
                {String(result.instructions)}
              </Text>
            )
          }
        ]
      : [])
  ];
};

let getResourcesOverviewSections = ({
  output
}: {
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let result = getMethodResult(output);
  let resources = Array.isArray(result?.resources) ? result.resources : [];
  let visibleResources = resources.slice(0, 6).map((resource: any, index: number) => ({
    description: resource.description ? String(resource.description) : undefined,
    details: [
      resource.name && resource.title && resource.name !== resource.title
        ? { label: 'Name', value: String(resource.name) }
        : null,
      resource.uri ? { label: 'URI', value: String(resource.uri) } : null,
      resource.mimeType ? { label: 'MIME Type', value: String(resource.mimeType) } : null
    ].filter(Boolean) as EntityDetail[],
    id: String(resource.uri ?? resource.name ?? index),
    title: String(resource.title ?? resource.name ?? resource.uri ?? `Resource ${index + 1}`)
  }));

  return [
    {
      id: 'resources',
      content: (
        <CatalogOverview
          emptyText="No resources were returned."
          icon={<RiFileTextLine />}
          items={visibleResources}
          moreText={
            result?.nextCursor
              ? 'More resources are available through pagination.'
              : resources.length > visibleResources.length
                ? `Showing the first ${visibleResources.length} of ${resources.length} resources.`
                : null
          }
        />
      )
    }
  ];
};

let getResourceTemplatesOverviewSections = ({
  output
}: {
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let result = getMethodResult(output);
  let templates = Array.isArray(result?.resourceTemplates) ? result.resourceTemplates : [];
  let visibleTemplates = templates.slice(0, 6).map((template: any, index: number) => ({
    description: template.description ? String(template.description) : undefined,
    details: [
      template.uriTemplate
        ? { label: 'URI Template', value: String(template.uriTemplate) }
        : null,
      template.mimeType ? { label: 'MIME Type', value: String(template.mimeType) } : null
    ].filter(Boolean) as EntityDetail[],
    id: String(template.uriTemplate ?? template.name ?? index),
    title: String(
      template.title ?? template.name ?? template.uriTemplate ?? `Template ${index + 1}`
    )
  }));

  return [
    {
      id: 'resource-templates',
      content: (
        <CatalogOverview
          emptyText="No resource templates were returned."
          icon={<RiFolderLine />}
          items={visibleTemplates}
          moreText={
            templates.length > visibleTemplates.length
              ? `Showing the first ${visibleTemplates.length} of ${templates.length} templates.`
              : null
          }
        />
      )
    }
  ];
};

let getToolsOverviewSections = ({
  output
}: {
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let result = getMethodResult(output);
  let tools = Array.isArray(result?.tools) ? result.tools : [];
  let visibleTools = tools.slice(0, 6).map((tool: any, index: number) => {
    let propertyCount = getSchemaPropertyCount(tool.inputSchema);
    let requiredCount = getSchemaRequiredCount(tool.inputSchema);

    return {
      description: tool.description ? String(tool.description) : undefined,
      details: [
        tool.name ? { label: 'Name', value: String(tool.name) } : null,
        {
          label: 'Inputs',
          value:
            propertyCount > 0 ? pluralize(propertyCount, 'input field') : 'No input fields'
        },
        requiredCount > 0
          ? { label: 'Required', value: pluralize(requiredCount, 'required field') }
          : null,
        tool.execution?.taskSupport && tool.execution.taskSupport !== 'forbidden'
          ? {
              label: 'Task Support',
              value: String(tool.execution.taskSupport)
            }
          : null
      ].filter(Boolean) as EntityDetail[],
      id: String(tool.name ?? index),
      title: String(tool.title ?? tool.name ?? `Tool ${index + 1}`)
    };
  });

  return [
    {
      id: 'tools',
      content: (
        <CatalogOverview
          emptyText="No tools were returned."
          icon={<RiToolsLine />}
          items={visibleTools}
          moreText={
            result?.nextCursor
              ? 'More tools are available through pagination.'
              : tools.length > visibleTools.length
                ? `Showing the first ${visibleTools.length} of ${tools.length} tools.`
                : null
          }
        />
      )
    }
  ];
};

let mimeTypeLanguageMap: Record<string, string> = {
  'application/json': 'json',
  'application/xml': 'xml',
  'application/yaml': 'yaml',
  'application/x-yaml': 'yaml',
  'application/javascript': 'javascript',
  'application/x-javascript': 'javascript',
  'application/typescript': 'typescript',
  'application/x-sh': 'bash',
  'text/plain': 'text',
  'text/markdown': 'markdown',
  'text/x-markdown': 'markdown',
  'text/html': 'html',
  'text/css': 'css',
  'text/xml': 'xml',
  'text/yaml': 'yaml',
  'text/x-yaml': 'yaml',
  'text/javascript': 'javascript',
  'text/typescript': 'typescript',
  'text/x-typescript': 'typescript',
  'text/x-python': 'python',
  'text/x-rust': 'rust',
  'text/x-go': 'go',
  'text/x-java': 'java',
  'text/x-c': 'c',
  'text/x-c++': 'cpp',
  'text/x-csharp': 'csharp',
  'text/x-ruby': 'ruby',
  'text/x-php': 'php',
  'text/x-swift': 'swift',
  'text/x-kotlin': 'kotlin',
  'text/x-scala': 'scala',
  'text/x-shellscript': 'bash',
  'text/x-sh': 'bash',
  'text/x-sql': 'sql',
  'text/csv': 'text',
  'text/tab-separated-values': 'text'
};

let uriExtensionLanguageMap: Record<string, string> = {
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  xml: 'xml',
  html: 'html',
  htm: 'html',
  css: 'css',
  md: 'markdown',
  markdown: 'markdown',
  js: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  jsx: 'jsx',
  ts: 'typescript',
  tsx: 'tsx',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  go: 'go',
  java: 'java',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  cs: 'csharp',
  php: 'php',
  swift: 'swift',
  kt: 'kotlin',
  scala: 'scala',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  sql: 'sql',
  toml: 'toml',
  ini: 'ini',
  txt: 'text'
};

let detectLanguage = (mimeType?: string | null, uri?: string | null) => {
  if (mimeType) {
    let normalized = mimeType.split(';')[0].trim().toLowerCase();
    if (mimeTypeLanguageMap[normalized]) return mimeTypeLanguageMap[normalized];
    if (normalized.startsWith('text/')) return 'text';
    if (normalized.endsWith('+json')) return 'json';
    if (normalized.endsWith('+xml')) return 'xml';
    if (normalized.endsWith('+yaml')) return 'yaml';
  }

  if (uri) {
    let withoutQuery = uri.split(/[?#]/)[0];
    let lastSegment = withoutQuery.split('/').pop() ?? '';
    let ext = lastSegment.includes('.')
      ? lastSegment.split('.').pop()?.toLowerCase()
      : undefined;
    if (ext && uriExtensionLanguageMap[ext]) return uriExtensionLanguageMap[ext];
  }

  return 'text';
};

let isImageMime = (mimeType?: string | null) =>
  !!mimeType && mimeType.toLowerCase().startsWith('image/');

let isAudioMime = (mimeType?: string | null) =>
  !!mimeType && mimeType.toLowerCase().startsWith('audio/');

let ResourceMeta = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-size: 12px;
  color: ${theme.colors.gray700};
  align-items: center;
`;

let ResourceMetaItem = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;

  strong {
    font-weight: 600;
    color: ${theme.colors.gray800};
  }
`;

let MediaWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.gray100};
`;

let MediaPreview = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;

  img {
    max-width: 100%;
    max-height: 320px;
    border-radius: 6px;
    display: block;
  }

  audio {
    width: 100%;
  }
`;

let MessageBlockWrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border: 1px solid ${theme.colors.gray300};
  border-radius: 8px;
  background: ${theme.colors.background};
`;

let MessageBlockHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: ${theme.colors.gray700};

  svg {
    width: 14px;
    height: 14px;
  }
`;

let ResourceLinkRow = styled.a`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid ${theme.colors.gray300};
  background: ${theme.colors.gray100};
  color: ${theme.colors.gray800};
  font-size: 12px;
  text-decoration: none;

  &:hover {
    background: ${theme.colors.gray200};
  }
`;

let StatusBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;

  &[data-variant='error'] {
    background: ${theme.colors.red100};
    color: ${theme.colors.red800};
    border: 1px solid ${theme.colors.red300};
  }

  &[data-variant='success'] {
    background: ${theme.colors.green100};
    color: ${theme.colors.green800};
    border: 1px solid ${theme.colors.green300};
  }
`;

let BlockStack = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

let ArgumentsView = ({ args }: { args: Record<string, any> | null | undefined }) => {
  if (!args || Object.keys(args).length === 0) {
    return (
      <Text size="1" color="gray700">
        No arguments provided.
      </Text>
    );
  }

  return <JsonViewer value={args} />;
};

let TextContentBlock = ({
  text,
  language
}: {
  text: string;
  language?: string;
}) => {
  let effectiveLanguage = language ?? 'text';
  let isPlain = effectiveLanguage === 'text' || effectiveLanguage === 'markdown';

  if (isPlain) {
    return (
      <pre
        style={{
          margin: 0,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          fontFamily:
            "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
          padding: '10px 12px',
          border: `1px solid ${theme.colors.gray300}`,
          borderRadius: 8,
          background: theme.colors.gray100,
          color: theme.colors.gray900
        }}
      >
        {text}
      </pre>
    );
  }

  return <CodeBlock language={effectiveLanguage} variant="bordered" code={text} />;
};

let ContentBlockView = ({ content, index }: { content: any; index: number }) => {
  let record = asRecord(content);
  let type = record?.type ? String(record.type) : undefined;

  if (type === 'text') {
    return (
      <TextContentBlock text={String(record?.text ?? '')} language="markdown" />
    );
  }

  if (type === 'image') {
    let mimeType = record?.mimeType ? String(record.mimeType) : 'image/png';
    let data = record?.data ? String(record.data) : '';
    return (
      <MediaWrapper>
        <MessageBlockHeader>
          <RiImageLine />
          <span>Image · {mimeType}</span>
        </MessageBlockHeader>
        {data ? (
          <MediaPreview>
            <img src={`data:${mimeType};base64,${data}`} alt={`Image ${index + 1}`} />
          </MediaPreview>
        ) : (
          <Text size="1" color="gray700">
            Image data missing.
          </Text>
        )}
      </MediaWrapper>
    );
  }

  if (type === 'audio') {
    let mimeType = record?.mimeType ? String(record.mimeType) : 'audio/wav';
    let data = record?.data ? String(record.data) : '';
    return (
      <MediaWrapper>
        <MessageBlockHeader>
          <RiMusic2Line />
          <span>Audio · {mimeType}</span>
        </MessageBlockHeader>
        {data ? (
          <MediaPreview>
            <audio controls src={`data:${mimeType};base64,${data}`} />
          </MediaPreview>
        ) : (
          <Text size="1" color="gray700">
            Audio data missing.
          </Text>
        )}
      </MediaWrapper>
    );
  }

  if (type === 'resource_link') {
    let uri = record?.uri ? String(record.uri) : '';
    let name = record?.name ? String(record.name) : uri;
    let description = record?.description ? String(record.description) : null;
    let mimeType = record?.mimeType ? String(record.mimeType) : null;

    return (
      <MediaWrapper>
        <MessageBlockHeader>
          <RiLink />
          <span>Resource Link</span>
        </MessageBlockHeader>
        <ResourceLinkRow href={uri} target="_blank" rel="noreferrer noopener">
          <RiFileTextLine />
          <span>
            <strong>{name}</strong>
            {uri && uri !== name ? ` · ${uri}` : null}
          </span>
        </ResourceLinkRow>
        {description ? (
          <Text size="1" color="gray700">
            {description}
          </Text>
        ) : null}
        {mimeType ? (
          <ResourceMeta>
            <ResourceMetaItem>
              <strong>MIME Type:</strong> {mimeType}
            </ResourceMetaItem>
          </ResourceMeta>
        ) : null}
      </MediaWrapper>
    );
  }

  if (type === 'resource') {
    let resource = asRecord(record?.resource);
    return <EmbeddedResourceView resource={resource} />;
  }

  return (
    <CodeBlock language="json" variant="bordered" code={formatRawJson(content)} />
  );
};

let EmbeddedResourceView = ({
  resource
}: {
  resource: Record<string, any> | null | undefined;
}) => {
  if (!resource) {
    return (
      <Text size="1" color="gray700">
        Empty resource.
      </Text>
    );
  }

  let uri = resource.uri ? String(resource.uri) : null;
  let mimeType = resource.mimeType ? String(resource.mimeType) : null;
  let name = resource.name ? String(resource.name) : null;
  let title = resource.title ? String(resource.title) : null;
  let hasBlob = typeof resource.blob === 'string' && resource.blob.length > 0;
  let text = typeof resource.text === 'string' ? resource.text : null;
  let language = detectLanguage(mimeType, uri);

  return (
    <MessageBlockWrapper>
      <MessageBlockHeader>
        {isImageMime(mimeType) ? (
          <RiImageLine />
        ) : isAudioMime(mimeType) ? (
          <RiMusic2Line />
        ) : (
          <RiFileTextLine />
        )}
        <span>Resource{title || name ? ` · ${title ?? name}` : ''}</span>
      </MessageBlockHeader>

      {(uri || mimeType) && (
        <ResourceMeta>
          {uri ? (
            <ResourceMetaItem>
              <strong>URI:</strong> {uri}
            </ResourceMetaItem>
          ) : null}
          {mimeType ? (
            <ResourceMetaItem>
              <strong>MIME Type:</strong> {mimeType}
            </ResourceMetaItem>
          ) : null}
        </ResourceMeta>
      )}

      {text != null ? (
        <TextContentBlock text={text} language={language} />
      ) : hasBlob && isImageMime(mimeType) ? (
        <MediaPreview>
          <img
            src={`data:${mimeType};base64,${String(resource.blob)}`}
            alt={name ?? title ?? uri ?? 'Resource'}
          />
        </MediaPreview>
      ) : hasBlob && isAudioMime(mimeType) ? (
        <MediaPreview>
          <audio controls src={`data:${mimeType};base64,${String(resource.blob)}`} />
        </MediaPreview>
      ) : hasBlob ? (
        <Text size="1" color="gray700">
          Binary content ({String(resource.blob).length.toLocaleString()} base64 chars).
        </Text>
      ) : (
        <Text size="1" color="gray700">
          No inline content.
        </Text>
      )}
    </MessageBlockWrapper>
  );
};

let ContentBlocksView = ({ content }: { content: unknown }) => {
  if (!Array.isArray(content) || content.length === 0) {
    return (
      <Text size="1" color="gray700">
        No content returned.
      </Text>
    );
  }

  return (
    <BlockStack>
      {content.map((block, index) => (
        <ContentBlockView key={index} content={block} index={index} />
      ))}
    </BlockStack>
  );
};

let roleMeta: Record<string, { icon: ReactNode; label: string }> = {
  user: { icon: <RiUser3Line />, label: 'User' },
  assistant: { icon: <RiRobot2Line />, label: 'Assistant' },
  system: { icon: <RiServerLine />, label: 'System' }
};

let PromptMessageView = ({ message }: { message: any }) => {
  let record = asRecord(message);
  let role = record?.role ? String(record.role) : 'user';
  let meta = roleMeta[role] ?? { icon: <RiChatQuoteLine />, label: role };
  let content = record?.content;
  let contents = Array.isArray(content) ? content : content ? [content] : [];

  return (
    <MessageBlockWrapper>
      <MessageBlockHeader>
        {meta.icon}
        <span>{meta.label}</span>
      </MessageBlockHeader>
      {contents.length === 0 ? (
        <Text size="1" color="gray700">
          Empty content.
        </Text>
      ) : (
        <BlockStack>
          {contents.map((block, index) => (
            <ContentBlockView key={index} content={block} index={index} />
          ))}
        </BlockStack>
      )}
    </MessageBlockWrapper>
  );
};

let getToolCallOverviewSections = ({
  input,
  output
}: {
  input: Record<string, any> | null;
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let params = getMethodParams(input);
  let result = getMethodResult(output);
  let args = asRecord(params?.arguments);
  let isError = result?.isError === true;
  let structuredContent = asRecord(result?.structuredContent);
  let content = result?.content;
  let hasContent = Array.isArray(content) && content.length > 0;

  let sections: OverviewSection[] = [
    {
      id: 'tool-arguments',
      label: 'Arguments',
      content: <ArgumentsView args={args} />
    }
  ];

  if (result || output) {
    sections.push({
      id: 'tool-result',
      label: 'Result',
      content: (
        <BlockStack>
          {isError ? (
            <div>
              <StatusBadge data-variant="error">
                <RiErrorWarningLine size={12} />
                Tool reported an error
              </StatusBadge>
            </div>
          ) : null}
          {structuredContent ? (
            <CodeBlock
              language="json"
              variant="bordered"
              code={formatRawJson(structuredContent)}
            />
          ) : hasContent ? (
            <ContentBlocksView content={content} />
          ) : (
            <Text size="1" color="gray700">
              No content returned.
            </Text>
          )}
        </BlockStack>
      )
    });
  }

  return sections;
};

let getResourceReadOverviewSections = ({
  input,
  output
}: {
  input: Record<string, any> | null;
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let params = getMethodParams(input);
  let result = getMethodResult(output);
  let uri = params?.uri ? String(params.uri) : null;
  let contents = Array.isArray(result?.contents) ? result.contents : [];

  return [
    {
      id: 'resource-request',
      label: 'Request',
      content: (
        <Entity.Wrapper>
          <Entity.Content>
            <Entity.Field
              title={uri ?? 'Unknown URI'}
              prefix={
                <OverviewEntityIcon>
                  <RiFileTextLine />
                </OverviewEntityIcon>
              }
            />
          </Entity.Content>
        </Entity.Wrapper>
      )
    },
    {
      id: 'resource-contents',
      label: 'Contents',
      content:
        contents.length === 0 ? (
          <Text size="1" color="gray700">
            No contents returned.
          </Text>
        ) : (
          <BlockStack>
            {contents.map((resource: any, index: number) => (
              <EmbeddedResourceView key={index} resource={asRecord(resource)} />
            ))}
          </BlockStack>
        )
    }
  ];
};

let getPromptGetOverviewSections = ({
  input,
  output
}: {
  input: Record<string, any> | null;
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let params = getMethodParams(input);
  let result = getMethodResult(output);
  let args = asRecord(params?.arguments);
  let description = result?.description ? String(result.description) : null;
  let messages = Array.isArray(result?.messages) ? result.messages : [];

  let sections: OverviewSection[] = [
    {
      id: 'prompt-arguments',
      label: 'Arguments',
      content: <ArgumentsView args={args} />
    }
  ];

  if (description) {
    sections.push({
      id: 'prompt-description',
      label: 'Description',
      content: (
        <Text size="1" color="gray800">
          {description}
        </Text>
      )
    });
  }

  sections.push({
    id: 'prompt-messages',
    label: 'Messages',
    content:
      messages.length === 0 ? (
        <Text size="1" color="gray700">
          No messages returned.
        </Text>
      ) : (
        <BlockStack>
          {messages.map((message, index) => (
            <PromptMessageView key={index} message={message} />
          ))}
        </BlockStack>
      )
  });

  return sections;
};

let getPromptsOverviewSections = ({
  output
}: {
  output: Record<string, any> | null;
}): OverviewSection[] => {
  let result = getMethodResult(output);
  let prompts = Array.isArray(result?.prompts) ? result.prompts : [];
  let visiblePrompts = prompts.slice(0, 6).map((prompt: any, index: number) => {
    let argumentCount = Array.isArray(prompt.arguments) ? prompt.arguments.length : 0;

    return {
      description: prompt.description ? String(prompt.description) : undefined,
      details: [
        prompt.name ? { label: 'Name', value: String(prompt.name) } : null,
        {
          label: 'Arguments',
          value: argumentCount > 0 ? pluralize(argumentCount, 'argument') : 'No arguments'
        }
      ].filter(Boolean) as EntityDetail[],
      id: String(prompt.name ?? index),
      title: String(prompt.title ?? prompt.name ?? `Prompt ${index + 1}`)
    };
  });

  return [
    {
      id: 'prompts',
      content: (
        <CatalogOverview
          emptyText="No prompts were returned."
          icon={<RiChatQuoteLine />}
          items={visiblePrompts}
          moreText={
            result?.nextCursor
              ? 'More prompts are available through pagination.'
              : prompts.length > visiblePrompts.length
                ? `Showing the first ${visiblePrompts.length} of ${prompts.length} prompts.`
                : null
          }
        />
      )
    }
  ];
};

let getMessagePresentation = ({
  input,
  message,
  method,
  output
}: {
  input: Record<string, any> | null;
  message: DashboardInstanceSessionsMessagesGetOutput;
  method: string;
  output: Record<string, any> | null;
}): MessagePresentation => {
  let transportMeta = getMessageTransportMeta(message);
  let params = getMethodParams(input);
  let result = getMethodResult(output);
  let clientInfo = asRecord(params?.clientInfo) ?? transportMeta?.client ?? null;
  let serverInfo = asRecord(result?.serverInfo) ?? transportMeta?.server ?? null;
  let clientName = getDisplayName(clientInfo, 'Client');
  let serverName = getDisplayName(serverInfo, 'Server');

  if (method === 'initialize') {
    return {
      defaultViewMode: 'overview',
      label: 'Initialization',
      overviewSections: getInitializeOverviewSections({ input, output, transportMeta }),
      summaryIcon: <RiExchangeLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>initialized MCP connection with</span>
          <strong>{serverName}</strong>
          <span>on Metorial</span>
        </SummaryTitle>
      )
    };
  }

  if (method === 'notifications/initialized') {
    return {
      hideCard: true,
      label: 'Initialization Confirmed',
      summaryIcon: <RiCheckboxCircleLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>confirmed initialization.</span>
        </SummaryTitle>
      )
    };
  }

  if (method === 'resources/list') {
    return {
      defaultViewMode: 'overview',
      label: 'Available Resources',
      overviewSections: getResourcesOverviewSections({ output }),
      summaryIcon: <RiFileListLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>requested available resources.</span>
        </SummaryTitle>
      )
    };
  }

  if (method === 'resources/templates/list') {
    return {
      defaultViewMode: 'overview',
      label: 'Resource Templates',
      overviewSections: getResourceTemplatesOverviewSections({ output }),
      summaryIcon: <RiFolderLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>requested resource templates.</span>
        </SummaryTitle>
      )
    };
  }

  if (method === 'tools/list') {
    return {
      defaultViewMode: 'overview',
      label: 'Available Tools',
      overviewSections: getToolsOverviewSections({ output }),
      summaryIcon: <RiToolsLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>requested available tools.</span>
        </SummaryTitle>
      )
    };
  }

  if (method === 'prompts/list') {
    return {
      defaultViewMode: 'overview',
      label: 'Available Prompts',
      overviewSections: getPromptsOverviewSections({ output }),
      summaryIcon: <RiChatQuoteLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>requested available prompts.</span>
        </SummaryTitle>
      )
    };
  }

  if (method === 'tools/call') {
    let toolName = params?.name ? String(params.name) : 'unknown tool';

    return {
      defaultViewMode: 'overview',
      label: (
        <>
          <span>Tool Call</span>
          <InlineCode>{toolName}</InlineCode>
        </>
      ),
      overviewSections: getToolCallOverviewSections({ input, output }),
      summaryIcon: <RiToolsLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>called tool</span>
          <strong>{toolName}</strong>
        </SummaryTitle>
      )
    };
  }

  if (method === 'resources/read') {
    let resourceName = params?.uri ? String(params.uri) : 'unknown resource';

    return {
      defaultViewMode: 'overview',
      label: (
        <>
          <span>Resource Read</span>
          <InlineCode>{resourceName}</InlineCode>
        </>
      ),
      overviewSections: getResourceReadOverviewSections({ input, output }),
      summaryIcon: <RiFileTextLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>requested resource</span>
          <strong>{resourceName}</strong>
        </SummaryTitle>
      )
    };
  }

  if (method === 'prompts/get') {
    let promptName = params?.name ? String(params.name) : 'unknown prompt';

    return {
      defaultViewMode: 'overview',
      label: (
        <>
          <span>Prompt Get</span>
          <InlineCode>{promptName}</InlineCode>
        </>
      ),
      overviewSections: getPromptGetOverviewSections({ input, output }),
      summaryIcon: <RiChatQuoteLine />,
      summaryText: (
        <SummaryTitle>
          <strong>{clientName}</strong>
          <span>requested prompt</span>
          <strong>{promptName}</strong>
        </SummaryTitle>
      )
    };
  }

  return {
    label: method,
    summaryIcon: <RiArrowRightSLine />,
    summaryText: (
      <SummaryTitle>
        <strong>{clientName}</strong>
        <span>sent</span>
        <strong>{method}</strong>
      </SummaryTitle>
    )
  };
};

let MessageCard = ({
  date,
  defaultViewMode = 'properties',
  error,
  id,
  input,
  isToolError,
  label,
  overviewSections = [],
  output,
  position
}: {
  date: Date;
  defaultViewMode?: 'overview' | 'properties' | 'raw';
  error?: DashboardInstanceSessionsMessagesGetOutput['error'];
  id?: string;
  input?: Record<string, any> | null;
  isToolError?: boolean;
  label: ReactNode;
  overviewSections?: OverviewSection[];
  output?: Record<string, any> | null;
  position: string;
}) => {
  let hasError = !!error || !!isToolError;
  let hasOverview = overviewSections.length > 0;
  let [viewMode, setViewMode] = useState<'overview' | 'properties' | 'raw'>(
    hasOverview ? defaultViewMode : 'properties'
  );

  let propertySections = [
    ...(getDefaultSection(input, 'Input')
      ? [{ id: 'input', ...getDefaultSection(input, 'Input')! }]
      : []),
    ...(getDefaultSection(output, 'Output')
      ? [{ id: 'output', ...getDefaultSection(output, 'Output')! }]
      : [])
  ];

  let rawSections = [
    ...(input ? [{ id: 'input-raw', label: 'Input JSON', value: input }] : []),
    ...(output ? [{ id: 'output-raw', label: 'Output JSON', value: output }] : [])
  ];

  let hasSections =
    viewMode === 'overview'
      ? overviewSections.length > 0
      : viewMode === 'properties'
        ? propertySections.length > 0
        : rawSections.length > 0;

  return (
    <Output data-position={position}>
      <Wrapper data-error={hasError ? 'true' : undefined}>
        <Header>
          <HeaderSection>
            {id && <ID>{shorten(id)}</ID>}
            <Title>{label}</Title>
          </HeaderSection>

          <HeaderActions>
            <RenderDate date={date} />

            <Menu
              items={[
                ...(hasOverview
                  ? [
                      {
                        id: 'overview',
                        label: 'Overview',
                        description: 'Show a concise MCP-specific summary of this message.'
                      }
                    ]
                  : []),
                {
                  id: 'properties',
                  label: 'Properties',
                  description: 'Show the structured request and response fields.'
                },
                {
                  id: 'raw',
                  label: 'Raw JSON',
                  description: 'Show the full underlying JSON payloads.'
                }
              ]}
              onItemClick={id => setViewMode(id as 'overview' | 'properties' | 'raw')}
            >
              <Button size="1" variant="ghost" iconRight={<RiArrowDownSLine size={14} />}>
                {viewMode === 'overview'
                  ? 'Overview'
                  : viewMode === 'properties'
                    ? 'Properties'
                    : 'Raw JSON'}
              </Button>
            </Menu>
          </HeaderActions>
        </Header>

        <Main>
          {hasSections ? (
            <Sections>
              {viewMode === 'overview'
                ? overviewSections.map(section => (
                    <Section key={section.id}>
                      {section.label ? <SectionHeader>{section.label}</SectionHeader> : null}
                      {section.content}
                    </Section>
                  ))
                : (viewMode === 'properties' ? propertySections : rawSections).map(section => (
                    <Section key={section.id}>
                      <SectionHeader>{section.label}</SectionHeader>
                      {viewMode === 'properties' ? (
                        <JsonViewer value={section.value} />
                      ) : (
                        <CodeBlock
                          language="json"
                          variant="seamless"
                          code={formatRawJson(section.value)}
                        />
                      )}
                    </Section>
                  ))}
            </Sections>
          ) : (
            <EmptyState>
              <Text size="1" color="gray700">
                No structured properties available. Switch to `Raw JSON` to inspect the full
                payload.
              </Text>
            </EmptyState>
          )}
        </Main>

        {error && (
          <ErrorSection>
            <ErrorRow>
              <ErrorLabel>Code</ErrorLabel>
              <ErrorValue>{error.code}</ErrorValue>
            </ErrorRow>
            <ErrorRow>
              <ErrorLabel>Message</ErrorLabel>
              <ErrorValue>{error.message}</ErrorValue>
            </ErrorRow>
            {error.data && Object.keys(error.data).length > 0 && (
              <Section>
                <SectionHeader>Error Data</SectionHeader>
                <JsonViewer value={error.data} />
              </Section>
            )}
          </ErrorSection>
        )}
      </Wrapper>
    </Output>
  );
};

export let ExplorerCapabilitiesMessageGroup = ({
  aggregatedMessages,
  clientName,
  messages
}: {
  aggregatedMessages: Map<string, AggregatedMessages>;
  clientName: string;
  messages: DashboardInstanceSessionsMessagesGetOutput[];
}) => {
  let [isOpen, setIsOpen] = useState(false);
  if (messages.length === 0) return null;

  let firstMessage = messages[0];

  return (
    <GroupWrapper>
      <GroupTrigger onClick={() => setIsOpen(v => !v)} type="button">
        <RiToolsLine />
        <span>
          <GroupTitle>
            <strong>{clientName} Explorer Capabilities</strong>

            <RiArrowRightSLine
              size={16}
              style={{
                transform: `rotate(${isOpen ? 90 : 0}deg)`,
                transition: 'transform 200ms ease'
              }}
            />
          </GroupTitle>
        </span>

        <GroupActions>
          <time>
            <RenderDate date={firstMessage.createdAt} />
          </time>
        </GroupActions>
      </GroupTrigger>

      <AnimatePresence initial={false}>
        {isOpen && (
          <AnimatedGroupContent
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
          >
            <GroupContent>
              {messages.map(message => (
                <Message
                  key={message.id}
                  aggregatedMessages={aggregatedMessages}
                  message={message}
                />
              ))}
            </GroupContent>
          </AnimatedGroupContent>
        )}
      </AnimatePresence>
    </GroupWrapper>
  );
};

export let Message = ({
  message,
  aggregatedMessages
}: {
  message: DashboardInstanceSessionsMessagesGetOutput;
  aggregatedMessages: Map<string, AggregatedMessages>;
}) => {
  let transportMcp = message.transport?.mcp;
  if (!transportMcp) return null;

  let payload = getMessagePayload(message);
  let messageKey = String(payload.id ?? transportMcp.id);
  let agg = aggregatedMessages.get(messageKey);

  if (!shouldRenderStandaloneMessage(message, aggregatedMessages)) {
    return null;
  }

  let inputMessage = agg?.request ?? (message.input ? message : undefined);
  let outputMessage = agg?.response ?? (message.output ? message : undefined);

  let input = (inputMessage?.input ?? null) as Record<string, any> | null;
  let output = (outputMessage?.output ?? null) as Record<string, any> | null;
  let method = getMessageMethod(message, aggregatedMessages) ?? message.type ?? 'message';
  let isResponseOnly = !input && !!output;
  let date = inputMessage?.createdAt ?? outputMessage?.createdAt ?? message.createdAt;
  let position = isResponseOnly
    ? 'server'
    : (inputMessage?.senderParticipant?.type ?? 'client');
  let presentation = getMessagePresentation({
    input,
    message,
    method,
    output
  });
  let isToolError = getMethodResult(output)?.isError === true;

  let messageError = outputMessage?.error ?? message.error ?? undefined;
  let hasError = !!messageError || isToolError;

  return (
    <MessageStack>
      <Entry
        icon={presentation.summaryIcon}
        title={presentation.summaryText}
        time={date}
        variant={hasError ? 'error' : undefined}
      />

      {!presentation.hideCard && (
        <MessageCard
          id={agg?.originalId}
          label={presentation.label}
          input={input}
          output={output}
          date={date}
          position={position}
          overviewSections={presentation.overviewSections}
          defaultViewMode={presentation.defaultViewMode}
          error={messageError}
          isToolError={isToolError}
        />
      )}
    </MessageStack>
  );
};
