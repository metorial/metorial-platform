import { formatNumber } from '@metorial/chart';
import { renderWithLoader } from '@metorial/data-hooks';
import { useFilterState } from '@metorial/data-list';
import { saveBlob } from '@metorial/file-browser';
import { Paths } from '@metorial/frontend-config';
import { MetricsSummary, type MetricsSummaryItem } from '@metorial/metrics-page';
import { useAgentTrackingMcpServerUsage, useAgentTrackingSkillUsage } from '@metorial/state';
import { Button, Callout, Flex, OptionToggle, Text, theme } from '@metorial/ui';
import { Box, FilterToolbar, Table } from '@metorial/ui-product';
import { useNow } from '@metorial/use-now';
import { RiArrowDownSLine, RiArrowRightSLine, RiDownload2Line } from '@remixicon/react';
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { styled } from 'styled-components';
import { useInstanceContext } from '../../lib/dataList';
import { formatDateTime } from './activity';
import { agentTrackingErrorFor } from './errorState';
import { WithInfo } from './info';
import {
  defaultAgentTrackingRange,
  formatAgentTrackingRange,
  getBrowserTimeZone,
  spendRangeFilter
} from './range';
import { useSearchParamOption, useSearchParamWriter } from './searchParams';
import { Muted } from './sessionParts';
import { SortHeader } from './sortHeader';
import {
  buildMcpServersCsv,
  buildSkillsCsv,
  defaultSortOrder,
  formatRate,
  membersFormatter,
  skillSortRows,
  sortToolRows,
  toolsCsvFileName,
  toolSortIds,
  unnamedNotice,
  type McpServerItem,
  type McpServerUsage,
  type McpToolItem,
  type SkillItem,
  type SkillUsage,
  type SortOrder,
  type ToolSort
} from './toolsSummary';

let views = [
  { id: 'mcp', label: 'MCP Servers' },
  { id: 'skills', label: 'Skills' }
] as const;

type ToolsView = (typeof views)[number]['id'];

let viewIds = views.map(view => view.id);

let orderIds = ['asc', 'desc'] as const;

let toolFilters = [spendRangeFilter.filter];

let sourceNote =
  'From agent telemetry: what Claude Code and Codex report about their own tool calls, not Metorial’s own MCP server logs.';

let ToolName = styled.span`
  padding-left: 30px;
  color: ${theme.colors.gray700};
`;

let useToolSort = () => {
  let [, setParam] = useSearchParamWriter();
  let [sort] = useSearchParamOption<ToolSort>('sort', toolSortIds, 'calls');
  let [order] = useSearchParamOption<SortOrder>('order', orderIds, defaultSortOrder(sort));

  let toggle = (next: ToolSort) => {
    let nextOrder = next == sort ? (order == 'asc' ? 'desc' : 'asc') : defaultSortOrder(next);

    setParam('sort', next == 'calls' ? undefined : next);
    setParam('order', nextOrder == defaultSortOrder(next) ? undefined : nextOrder);
  };

  return { sort, order, toggle };
};

type ToolSorting = ReturnType<typeof useToolSort>;

let sortHeader = (sorting: ToolSorting, id: ToolSort, label: string, info?: string) => (
  <SortHeader
    key={id}
    label={label}
    info={info}
    active={sorting.sort == id}
    ascending={sorting.order == 'asc'}
    onToggle={() => sorting.toggle(id)}
  />
);

let LastUsed = ({ date, now }: { date: Date | string | null; now: Date }) =>
  date ? (
    <span style={{ whiteSpace: 'nowrap' }}>{formatDateTime(new Date(date), now)}</span>
  ) : (
    <Muted>—</Muted>
  );

let detailsOffNote = (subject: string) =>
  `Detailed Tool Reporting is off, so Claude Code set up by Metorial Desktop or the Agent Usage settings file sends no custom ${subject} names. Codex sends them either way. The counts still include every use without a name. An organization admin can turn it on in the Agent Usage settings; usage sent before that keeps no names.`;

let ExportButton = ({ onClick }: { onClick: () => void }) => (
  <Button size="2" variant="outline" iconLeft={<RiDownload2Line />} onClick={onClick}>
    Export CSV
  </Button>
);

let saveCsv = (csv: string, fileName: string) =>
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName);

let MetorialUsageLink = () => {
  let ctx = useInstanceContext();

  return (
    <Link to={Paths.instance.usage(ctx.organization, ctx.project, ctx.instance)}>
      <Button size="2" variant="outline" as="span">
        Metorial MCP Usage
      </Button>
    </Link>
  );
};

let ServerProvider = ({ provider }: { provider: McpServerItem['provider'] }) => {
  let ctx = useInstanceContext();
  if (!provider?.name) return null;

  return (
    <Link
      to={Paths.instance.provider(ctx.organization, ctx.project, ctx.instance, provider.id)}
    >
      <Text as="span" size="1" color="gray600">
        {provider.name}
      </Text>
    </Link>
  );
};

let MetorialSkill = ({ skill }: { skill: SkillItem['skill'] }) => {
  let ctx = useInstanceContext();
  if (!skill) return null;

  return (
    <Link to={Paths.instance.skill(ctx.organization, ctx.project, ctx.instance, skill.id)}>
      <Text as="span" size="1" color="gray600">
        {skill.name}
      </Text>
    </Link>
  );
};

let McpServersTable = ({ usage }: { usage: McpServerUsage }) => {
  let sorting = useToolSort();
  let now = useNow();
  let [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  let members = membersFormatter(usage.summary.countsCapped, [
    usage.summary.members,
    ...usage.items.flatMap(item => [item.members, ...item.tools.map(tool => tool.members)])
  ]);

  let toggle = (name: string) =>
    setExpanded(current => {
      let next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  let callCells = (item: McpServerItem | McpToolItem) => [
    formatNumber(item.calls),
    formatRate(item.errorRate),
    members(item.members),
    <LastUsed key="last" date={item.lastUsedAt} now={now} />
  ];

  let rows = sortToolRows(usage.items, sorting.sort, sorting.order).flatMap(server => {
    let open = expanded.has(server.name);
    let serverRow = [
      <Flex key="name" align="center" gap={6}>
        <Button
          size="1"
          variant="ghost"
          iconLeft={open ? <RiArrowDownSLine /> : <RiArrowRightSLine />}
          aria-label={
            open ? `Hide the tools of ${server.name}` : `Show the tools of ${server.name}`
          }
          title={open ? 'Hide Tools' : 'Show Tools'}
          aria-expanded={open}
          disabled={!server.tools.length}
          onClick={() => toggle(server.name)}
        />
        <Text as="span" size="2" weight="medium">
          {server.name}
        </Text>
        <ServerProvider provider={server.provider} />
      </Flex>,
      ...callCells(server)
    ];

    let toolRows = open
      ? sortToolRows(server.tools, sorting.sort, sorting.order).map(tool => [
          <ToolName key="name">{tool.name}</ToolName>,
          ...callCells(tool)
        ])
      : [];

    return [serverRow, ...toolRows];
  });

  return (
    <Table
      headers={[
        sortHeader(sorting, 'name', 'Server'),
        sortHeader(sorting, 'calls', 'Calls'),
        sortHeader(
          sorting,
          'error_rate',
          'Error Rate',
          'Calls that ended in an error, a timeout, a refusal or a block.'
        ),
        sortHeader(sorting, 'members', 'Members'),
        sortHeader(sorting, 'last_used', 'Last Used')
      ]}
      data={rows}
    />
  );
};

type ToolUsageBoxProps = {
  title: string;
  subject: string;
  usage: {
    range: McpServerUsage['range'];
    toolDetails: boolean;
    items: unknown[];
    truncated: boolean;
  };
  summary: MetricsSummaryItem[];
  unnamed: string | null;
  table: React.ReactNode;
  emptyText: string;
  truncatedText: string;
  onExport: () => void;
  actions?: React.ReactNode;
};

let ToolUsageBox = (props: ToolUsageBoxProps) => {
  let hasItems = !!props.usage.items.length;
  let note = props.unnamed ?? (hasItems ? null : props.emptyText);
  let info = props.usage.toolDetails
    ? sourceNote
    : `${sourceNote} ${detailsOffNote(props.subject)}`;

  return (
    <Box
      title={<WithInfo info={info}>{props.title}</WithInfo>}
      description={formatAgentTrackingRange(props.usage.range)}
      rightActions={
        <Flex align="center" gap={8}>
          {props.actions}
          {hasItems ? <ExportButton onClick={props.onExport} /> : null}
        </Flex>
      }
    >
      <Flex direction="column" gap={16}>
        <MetricsSummary columns={props.summary.length} items={props.summary} />

        {note ? (
          <Text size="2" color="gray600">
            {note}
          </Text>
        ) : null}

        {hasItems ? props.table : null}

        {props.usage.truncated ? <Callout color="gray">{props.truncatedText}</Callout> : null}
      </Flex>
    </Box>
  );
};

let membersSummaryItem = (summary: {
  members: number;
  countsCapped: boolean;
}): MetricsSummaryItem => ({
  id: 'members',
  label: 'Members',
  value: membersFormatter(summary.countsCapped, [summary.members])(summary.members)
});

let McpServerUsageBox = ({ usage }: { usage: McpServerUsage }) => (
  <ToolUsageBox
    title="MCP Servers"
    subject="MCP server"
    usage={usage}
    summary={[
      { id: 'calls', label: 'MCP Tool Calls', value: formatNumber(usage.summary.calls) },
      { id: 'errorRate', label: 'Error Rate', value: formatRate(usage.summary.errorRate) },
      membersSummaryItem(usage.summary)
    ]}
    unnamed={unnamedNotice({
      total: usage.summary.calls,
      named: usage.summary.namedCalls,
      unit: 'MCP tool call',
      name: 'server name'
    })}
    table={<McpServersTable usage={usage} />}
    emptyText="No MCP tool calls in this range."
    truncatedText="More servers or tools were used than are listed; the most used are shown."
    onExport={() => saveCsv(buildMcpServersCsv(usage), toolsCsvFileName('mcp', usage.range))}
    actions={<MetorialUsageLink />}
  />
);

let SkillsTable = ({ usage }: { usage: SkillUsage }) => {
  let sorting = useToolSort();
  let now = useNow();
  let sort = sorting.sort == 'error_rate' ? 'calls' : sorting.sort;
  let members = membersFormatter(usage.summary.countsCapped, [
    usage.summary.members,
    ...usage.items.map(item => item.members)
  ]);

  return (
    <Table
      headers={[
        sortHeader(sorting, 'name', 'Skill'),
        sortHeader(sorting, 'calls', 'Activations'),
        sortHeader(sorting, 'members', 'Members'),
        sortHeader(sorting, 'last_used', 'Last Used')
      ]}
      data={sortToolRows(skillSortRows(usage.items), sort, sorting.order).map(item => [
        <Flex key="name" align="center" gap={6}>
          <Text as="span" size="2" weight="medium">
            {item.name}
          </Text>
          <MetorialSkill skill={item.skill} />
        </Flex>,
        formatNumber(item.activations),
        members(item.members),
        <LastUsed key="last" date={item.lastUsedAt} now={now} />
      ])}
    />
  );
};

let SkillUsageBox = ({ usage }: { usage: SkillUsage }) => (
  <ToolUsageBox
    title="Skills"
    subject="skill"
    usage={usage}
    summary={[
      {
        id: 'activations',
        label: 'Skill Activations',
        value: formatNumber(usage.summary.activations)
      },
      membersSummaryItem(usage.summary)
    ]}
    unnamed={unnamedNotice({
      total: usage.summary.activations,
      named: usage.summary.namedActivations,
      unit: 'skill activation',
      name: 'skill name'
    })}
    table={<SkillsTable usage={usage} />}
    emptyText="No skill activations in this range."
    truncatedText="More skills were used than are listed; the most used are shown."
    onExport={() => saveCsv(buildSkillsCsv(usage), toolsCsvFileName('skills', usage.range))}
  />
);

type UsageLoader<Data> = Omit<
  Parameters<typeof renderWithLoader>[0][string] & object,
  'data'
> & {
  input: unknown;
  data: Data | null | undefined;
  refetch: () => void;
};

let UsageSection = <Data,>({
  usage,
  children
}: {
  usage: UsageLoader<Data>;
  children: (data: Data) => React.ReactNode;
}) =>
  renderWithLoader(
    { usage },
    { error: agentTrackingErrorFor(usage) }
  )(({ usage }) => children(usage.data));

export let AgentTrackingTools = ({ instanceId }: { instanceId: string }) => {
  let [view, setView] = useSearchParamOption<ToolsView>('view', viewIds, 'mcp');
  let { filterState, payload } = useFilterState({ filters: toolFilters });
  let range = spendRangeFilter.parse(payload.range)?.[0] ?? defaultAgentTrackingRange;
  let query = { range, timeZone: getBrowserTimeZone() };
  let mcpUsage = useAgentTrackingMcpServerUsage(instanceId, view == 'mcp' ? query : null);
  let skillUsage = useAgentTrackingSkillUsage(instanceId, view == 'skills' ? query : null);

  return (
    <Flex direction="column" gap={20}>
      <Flex align="center" gap={12} wrap="wrap">
        <div>
          <OptionToggle
            size="2"
            ariaLabel="Show"
            items={views.map(item => ({ id: item.id, label: item.label }))}
            value={view}
            onChange={value => setView(value as ToolsView)}
          />
        </div>

        <FilterToolbar
          filters={toolFilters}
          filterState={filterState}
          placeholder="Filter..."
        />
      </Flex>

      {view == 'mcp' ? (
        <UsageSection usage={mcpUsage}>
          {usage => <McpServerUsageBox usage={usage} />}
        </UsageSection>
      ) : (
        <UsageSection usage={skillUsage}>
          {usage => <SkillUsageBox usage={usage} />}
        </UsageSection>
      )}
    </Flex>
  );
};
