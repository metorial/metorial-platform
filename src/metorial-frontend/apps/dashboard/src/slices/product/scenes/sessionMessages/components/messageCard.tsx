import { CodeBlock } from '@metorial/code';
import { JsonViewer } from '@metorial/json-viewer';
import { Button, Datalist, Menu, Text } from '@metorial/ui';
import { RiArrowDownSLine, RiErrorWarningLine } from '@remixicon/react';
import { type ReactNode, useState } from 'react';
import {
  EmptyState,
  Header,
  HeaderActions,
  HeaderSection,
  ID,
  InlineCode,
  Main,
  MetaCard,
  MetaDescription,
  MetaHeader,
  Output,
  Section,
  SectionHeader,
  Sections,
  StatusBadge,
  Title,
  Wrapper
} from '../styles';
import type { DashboardInstanceSessionsMessagesGetOutput, OverviewSection } from '../types';
import { asRecord, formatRawJson, getDefaultSection, shorten } from '../utils';

let isPresentValue = (value: unknown) => value !== null && value !== undefined && value !== '';

let stringifyValue = (value: unknown) => {
  if (!isPresentValue(value)) return null;
  return typeof value === 'string' ? value : String(value);
};

let getMergedError = (error?: DashboardInstanceSessionsMessagesGetOutput['error']) => {
  let errorRecord = asRecord(error);
  if (!errorRecord) return null;

  let nestedData = asRecord(errorRecord.data);
  let { data, ...topLevel } = errorRecord;

  return {
    ...nestedData,
    ...topLevel
  };
};

let getTraceRecord = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) return null;
  return asRecord(value[0]);
};

let parseJsonRecord = (value: unknown) => {
  if (typeof value !== 'string') return null;

  try {
    return asRecord(JSON.parse(value));
  } catch {
    return null;
  }
};

type MetaEntry = {
  label: string;
  value: ReactNode;
};

let buildErrorOverviewSections = (
  error?: DashboardInstanceSessionsMessagesGetOutput['error']
): OverviewSection[] => {
  let normalizedError = getMergedError(error);
  if (!normalizedError) return [];

  let provider = asRecord(normalizedError.provider);
  let upstream = asRecord(normalizedError.upstream);
  let baggage = asRecord(normalizedError.baggage);
  let baggageResponse = asRecord(baggage?.response);
  let trace = getTraceRecord(normalizedError.requestTraces);
  let traceRequest = asRecord(trace?.request);
  let traceResponse = asRecord(trace?.response);
  let traceError = asRecord(trace?.error);
  let traceResponseBody = asRecord(traceResponse?.body);
  let parsedTraceBody = parseJsonRecord(traceResponseBody?.text);

  let code = stringifyValue(normalizedError.code);
  let message = stringifyValue(normalizedError.message);
  let kind = stringifyValue(normalizedError.kind);
  let status = stringifyValue(normalizedError.status);
  let providerName = stringifyValue(provider?.key ?? provider?.name);
  let retryable =
    typeof normalizedError.retryable === 'boolean' ? normalizedError.retryable : null;

  let upstreamMethod = stringifyValue(upstream?.method ?? traceRequest?.method);
  let upstreamUrl = stringifyValue(upstream?.url ?? traceRequest?.url);
  let traceRows = [
    upstreamUrl
      ? {
          label: 'Endpoint',
          value: (
            <>
              {upstreamMethod ? <InlineCode>{upstreamMethod}</InlineCode> : null}
              {upstreamMethod ? ' ' : null}
              {upstreamUrl}
            </>
          )
        }
      : null,
    { label: 'Upstream Code', value: stringifyValue(upstream?.code) },
    { label: 'Status', value: stringifyValue(upstream?.status ?? traceResponse?.status) },
    { label: 'Status Text', value: stringifyValue(traceResponse?.statusText) },
    {
      label: 'Duration',
      value: isPresentValue(trace?.durationMs) ? `${trace?.durationMs} ms` : null
    },
    {
      label: 'Response Error',
      value: stringifyValue(baggageResponse?.error ?? parsedTraceBody?.error)
    },
    {
      label: 'Description',
      value: stringifyValue(
        baggageResponse?.error_description ?? parsedTraceBody?.error_description
      )
    },
    { label: 'Axios Code', value: stringifyValue(baggage?.axiosCode) },
    { label: 'Trace Error', value: stringifyValue(traceError?.message) },
    { label: 'Trace Code', value: stringifyValue(traceError?.code) }
  ].filter(row => !!row && isPresentValue(row.value)) as MetaEntry[];

  let traceCount = Array.isArray(normalizedError.requestTraces)
    ? normalizedError.requestTraces.length
    : 0;

  return [
    {
      id: 'error-summary',
      label: 'Summary',
      content: (
        <MetaCard>
          <MetaHeader>
            <StatusBadge data-variant="error">
              <RiErrorWarningLine size={12} />
              Error
            </StatusBadge>
            {code ? <InlineCode>{code}</InlineCode> : null}
            {kind ? <InlineCode>{kind}</InlineCode> : null}
            {status ? <InlineCode>{status}</InlineCode> : null}
            {retryable !== null ? (
              <InlineCode>{retryable ? 'retryable' : 'not retryable'}</InlineCode>
            ) : null}
          </MetaHeader>

          {message ? <MetaDescription>{message}</MetaDescription> : null}
        </MetaCard>
      )
    },
    ...(traceRows.length > 0 || traceCount > 1
      ? [
          {
            id: 'error-trace',
            label: 'Trace',
            content: (
              <MetaCard>
                <Datalist items={traceRows} />
                {traceCount > 1 ? (
                  <Text size="1" color="gray700">
                    Showing the first of {traceCount} request traces.
                  </Text>
                ) : null}
              </MetaCard>
            )
          }
        ]
      : [])
  ];
};

export let MessageCard = ({
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
  let errorOverviewSections = buildErrorOverviewSections(error);
  let combinedOverviewSections = [...errorOverviewSections, ...overviewSections];
  let hasOverview = combinedOverviewSections.length > 0;
  let [viewMode, setViewMode] = useState<'overview' | 'properties' | 'raw'>(
    errorOverviewSections.length > 0
      ? 'overview'
      : hasOverview
        ? defaultViewMode
        : 'properties'
  );

  let propertySections = [
    ...(error ? [{ id: 'error', label: 'Error', value: error }] : []),
    ...(getDefaultSection(input, 'Input')
      ? [{ id: 'input', ...getDefaultSection(input, 'Input')! }]
      : []),
    ...(getDefaultSection(output, 'Output')
      ? [{ id: 'output', ...getDefaultSection(output, 'Output')! }]
      : [])
  ];

  let rawSections = [
    ...(error ? [{ id: 'error-raw', label: 'Error JSON', value: error }] : []),
    ...(input ? [{ id: 'input-raw', label: 'Input JSON', value: input }] : []),
    ...(output ? [{ id: 'output-raw', label: 'Output JSON', value: output }] : [])
  ];

  let hasSections =
    viewMode === 'overview'
      ? combinedOverviewSections.length > 0
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
            {/* <RenderDate date={date} /> */}

            <Menu
              items={[
                ...(hasOverview
                  ? [
                      {
                        id: 'overview',
                        label: 'Overview',
                        description: 'Show the most important details from this message first.'
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
                ? combinedOverviewSections.map(section => (
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
      </Wrapper>
    </Output>
  );
};
