import { CodeBlock } from '@metorial/code';
import { Button, Menu, RenderDate, Text } from '@metorial/ui';
import { RiArrowDownSLine } from '@remixicon/react';
import { type ReactNode, useState } from 'react';
import { JsonViewer } from '../../../../../components/jsonViewer';
import {
  EmptyState,
  ErrorLabel,
  ErrorRow,
  ErrorSection,
  ErrorValue,
  Header,
  HeaderActions,
  HeaderSection,
  ID,
  Main,
  Output,
  Section,
  SectionHeader,
  Sections,
  Title,
  Wrapper
} from '../styles';
import type { DashboardInstanceSessionsMessagesGetOutput, OverviewSection } from '../types';
import { formatRawJson, getDefaultSection, shorten } from '../utils';

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
