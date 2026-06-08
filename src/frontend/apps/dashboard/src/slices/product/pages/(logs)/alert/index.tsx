import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { CodeBlock } from '@metorial/code';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useMonitorAlert,
  useProviderSpecification,
  useProtoGuardAlert
} from '@metorial/state';
import { Badge, Button, Flex, Text, theme } from '@metorial/ui';
import { Link, useParams } from 'react-router-dom';
import { Fragment, useState } from 'react';
import styled from 'styled-components';
import { ProtoGuardSeverityBadge } from '../../../scenes/monitoring/badges';

type MonitorAlert = any;
type ProtoGuardAlert = any;
type ProviderSpecification = any;
type CapabilityItem = {
  id?: string;
  key: string;
  name: string;
  description: string | null;
  type?: string;
  capabilities?: unknown;
  inputSchema?: unknown;
  outputSchema?: unknown;
  scopes?: unknown;
  invocation?: unknown;
  constraints?: unknown;
  instructions?: unknown;
  tags?: unknown;
};
type CapabilityChange = {
  change: 'added' | 'removed' | 'changed';
  key: string;
  fields: string[];
  before: CapabilityItem | null;
  after: CapabilityItem | null;
};
type ExpandableRow = {
  id: string;
  cells: React.ReactNode[];
  details: unknown;
};

let PageWrapper = styled.div`
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

let Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

let NameCell = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

let TableWrapper = styled.div`
  overflow-x: auto;
  width: 100%;
  min-width: 0;
`;

let ExpandableTableWrapper = styled.table`
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  font-size: 14px;
`;

let ExpandableTableHead = styled.th`
  border-bottom: 1px solid ${theme.colors.gray300};
  text-align: left;
  padding: 8px 10px;
  font-weight: 600;
`;

let ExpandableTableCell = styled.td`
  border-bottom: 1px solid ${theme.colors.gray300};
  padding: 10px;
  vertical-align: top;
`;

let ExpandableTableRow = styled.tr`
  cursor: pointer;

  &:hover {
    background: ${theme.colors.gray200};
  }
`;

let DetailsCell = styled.td`
  border-bottom: 1px solid ${theme.colors.gray300};
  padding: 14px 10px 18px;
  min-width: 0;
  max-width: 0;
`;

let DetailsInner = styled.div`
  width: 100%;
  min-width: 0;
  overflow: hidden;
`;

let EmptyText = ({ children }: { children: React.ReactNode }) => (
  <Text size="2" color="gray600">
    {children}
  </Text>
);

let formatJson = (value: unknown) => JSON.stringify(value ?? null, null, 2);

let ExpandableTable = ({ headers, rows }: { headers: string[]; rows: ExpandableRow[] }) => {
  let [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  return (
    <TableWrapper>
      <ExpandableTableWrapper>
        <thead>
          <tr>
            {headers.map(header => (
              <ExpandableTableHead key={header}>{header}</ExpandableTableHead>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => {
            let isExpanded = expandedRowId === row.id;

            return (
              <Fragment key={row.id}>
                <ExpandableTableRow
                  tabIndex={0}
                  onClick={() => setExpandedRowId(isExpanded ? null : row.id)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setExpandedRowId(isExpanded ? null : row.id);
                    }
                  }}
                >
                  {row.cells.map((cell, index) => (
                    <ExpandableTableCell key={`${row.id}:${index}`}>
                      {cell}
                    </ExpandableTableCell>
                  ))}
                </ExpandableTableRow>
                {isExpanded && (
                  <tr>
                    <DetailsCell colSpan={headers.length}>
                      <DetailsInner>
                        <CodeBlock
                          language="json"
                          code={formatJson(row.details)}
                          padding="12px"
                        />
                      </DetailsInner>
                    </DetailsCell>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </ExpandableTableWrapper>
    </TableWrapper>
  );
};

let stableJson = (value: unknown) => JSON.stringify(value ?? null);

let changedFieldsFor = (before: CapabilityItem, after: CapabilityItem) => {
  let fields: string[] = [];

  if (before.name !== after.name) fields.push('name');
  if ((before.description ?? '') !== (after.description ?? '')) fields.push('description');
  if (before.type !== after.type) fields.push('type');
  if (stableJson(before.capabilities) !== stableJson(after.capabilities)) {
    fields.push('capabilities');
  }
  if (stableJson(before.inputSchema) !== stableJson(after.inputSchema)) {
    fields.push('input schema');
  }
  if (stableJson(before.outputSchema) !== stableJson(after.outputSchema)) {
    fields.push('output schema');
  }
  if (stableJson(before.scopes) !== stableJson(after.scopes)) fields.push('scopes');
  if (stableJson(before.invocation) !== stableJson(after.invocation))
    fields.push('invocation');
  if (stableJson(before.constraints) !== stableJson(after.constraints))
    fields.push('constraints');
  if (stableJson(before.instructions) !== stableJson(after.instructions)) {
    fields.push('instructions');
  }
  if (stableJson(before.tags) !== stableJson(after.tags)) fields.push('tags');

  return fields;
};

let diffCapabilities = (
  beforeItems: CapabilityItem[] = [],
  afterItems: CapabilityItem[] = []
): CapabilityChange[] => {
  let beforeByKey = new Map(beforeItems.map(item => [item.key, item]));
  let afterByKey = new Map(afterItems.map(item => [item.key, item]));
  let changes: CapabilityChange[] = [];

  for (let after of afterItems) {
    let before = beforeByKey.get(after.key);
    if (!before) {
      changes.push({
        change: 'added',
        key: after.key,
        fields: ['definition'],
        before: null,
        after
      });
      continue;
    }

    let fields = changedFieldsFor(before, after);
    if (fields.length > 0) {
      changes.push({ change: 'changed', key: after.key, fields, before, after });
    }
  }

  for (let before of beforeItems) {
    if (afterByKey.has(before.key)) continue;
    changes.push({
      change: 'removed',
      key: before.key,
      fields: ['definition'],
      before,
      after: null
    });
  }

  return changes.sort((a, b) => a.key.localeCompare(b.key));
};

let getSpecificationDiff = (
  before: ProviderSpecification | null,
  after: ProviderSpecification | null
) => ({
  tools: diffCapabilities(before?.tools ?? [], after?.tools ?? []),
  authMethods: diffCapabilities(before?.authMethods ?? [], after?.authMethods ?? []),
  triggers: diffCapabilities((before as any)?.triggers ?? [], (after as any)?.triggers ?? [])
});

let labelForChange = (change: CapabilityChange) => {
  if (change.change === 'added') return change.after?.name ?? change.key;
  if (change.change === 'removed') return change.before?.name ?? change.key;
  return change.after?.name ?? change.before?.name ?? change.key;
};

let colorForChange = (change: CapabilityChange['change']) => {
  if (change === 'added') return 'green' as const;
  if (change === 'removed') return 'red' as const;
  return 'orange' as const;
};

let allCapabilityChanges = (diff: ReturnType<typeof getSpecificationDiff>) => [
  ...diff.tools.map(change => ({ ...change, kind: 'Tool' })),
  ...diff.authMethods.map(change => ({ ...change, kind: 'Auth method' })),
  ...diff.triggers.map(change => ({ ...change, kind: 'Trigger' }))
];

let fieldBadges = (fields: string[]) => (
  <Flex gap="1" wrap="wrap">
    {fields.map(field => (
      <Badge key={field} color="gray" size="1">
        {field}
      </Badge>
    ))}
  </Flex>
);

let capabilityChangeDetails = (change: CapabilityChange & { kind: string }) => ({
  kind: change.kind,
  change: change.change,
  key: change.key,
  changedFields: change.fields,
  before: change.before,
  after: change.after
});

let CapabilityChangesTable = ({
  diff,
  triggersUnavailable
}: {
  diff: ReturnType<typeof getSpecificationDiff>;
  triggersUnavailable: boolean;
}) => {
  let rows = allCapabilityChanges(diff);

  return (
    <Section>
      {rows.length ? (
        <ExpandableTable
          headers={['Kind', 'Change', 'Name', 'Changed', 'Before', 'After']}
          rows={rows.map(change => ({
            id: `${change.kind}:${change.change}:${change.key}`,
            cells: [
              change.kind,
              <Badge color={colorForChange(change.change)}>{change.change}</Badge>,
              <NameCell>
                <Text size="2" weight="strong">
                  {labelForChange(change)}
                </Text>
                <Text size="1" color="gray600">
                  {change.key}
                </Text>
              </NameCell>,
              change.change === 'changed' ? fieldBadges(change.fields) : 'Definition',
              change.before?.name ?? 'None',
              change.after?.name ?? 'None'
            ],
            details: capabilityChangeDetails(change)
          }))}
        />
      ) : (
        <EmptyText>
          No tool, auth method, or trigger changes were found in the fetched specifications.
        </EmptyText>
      )}

      {triggersUnavailable && (
        <Text size="1" color="gray600">
          Trigger details are not included in this specification response yet.
        </Text>
      )}
    </Section>
  );
};

let SchemaCapabilityDiff = ({
  fromSpecification,
  toSpecification
}: {
  fromSpecification: ReturnType<typeof useProviderSpecification>;
  toSpecification: ReturnType<typeof useProviderSpecification>;
}) =>
  renderWithLoader({ fromSpecification, toSpecification })(
    ({ fromSpecification, toSpecification }) => {
      let before = fromSpecification.data;
      let after = toSpecification.data;
      let diff = getSpecificationDiff(before, after);

      return (
        <CapabilityChangesTable
          diff={diff}
          triggersUnavailable={
            !('triggers' in (before as any)) && !('triggers' in (after as any))
          }
        />
      );
    }
  );

let SchemaChangeAlertDetail = ({ alert }: { alert: MonitorAlert }) => {
  let notification = alert.specificationChangeNotification;
  let instance = useCurrentInstance();
  let fromSpecification = useProviderSpecification(
    instance.data?.id,
    notification?.fromSpecification?.id
  );
  let toSpecification = useProviderSpecification(
    instance.data?.id,
    notification?.toSpecification?.id
  );

  if (!notification) {
    return (
      <Section>
        <EmptyText>No schema change notification is attached to this alert.</EmptyText>
      </Section>
    );
  }

  return (
    <>
      {notification.fromSpecification?.id && notification.toSpecification?.id ? (
        <SchemaCapabilityDiff
          fromSpecification={fromSpecification}
          toSpecification={toSpecification}
        />
      ) : (
        <Section>
          <EmptyText>
            Capability comparison needs both the previous and current specification.
          </EmptyText>
        </Section>
      )}
    </>
  );
};

let ProtoGuardAlertDetail = ({ protoGuardAlert }: { protoGuardAlert: ProtoGuardAlert }) => {
  let instance = useCurrentInstance();
  let project = useCurrentProject();
  let organization = useCurrentOrganization();
  let strongestFilter =
    protoGuardAlert.filters.find((filter: any) => filter.severity === 'critical') ??
    protoGuardAlert.filters.find((filter: any) => filter.severity === 'high') ??
    protoGuardAlert.filters[0];

  return (
    <>
      <Section>
        <Flex gap="2" wrap="wrap">
          {protoGuardAlert.sessionId && (
            <Link
              to={Paths.instance.providerSession(
                organization.data,
                project.data,
                instance.data,
                protoGuardAlert.sessionId
              )}
            >
              <Button size="2" variant="outline">
                Open session
              </Button>
            </Link>
          )}
          {protoGuardAlert.providerRunId && (
            <Link
              to={Paths.instance.providerRun(
                organization.data,
                project.data,
                instance.data,
                protoGuardAlert.providerRunId
              )}
            >
              <Button size="2" variant="outline">
                Open provider run
              </Button>
            </Link>
          )}
          {strongestFilter && (
            <Text size="2" color="gray600">
              {strongestFilter.name} matched with {strongestFilter.confidence ?? 'unknown'}{' '}
              confidence.
            </Text>
          )}
        </Flex>

        {protoGuardAlert.filters.length ? (
          <ExpandableTable
            headers={['Filter', 'Severity', 'Confidence', 'Issue type']}
            rows={protoGuardAlert.filters.map((filter: any, index: number) => ({
              id: filter.id ?? filter.filterId ?? `${filter.name}:${index}`,
              cells: [
                <NameCell>
                  <Text size="2" weight="strong">
                    {filter.name}
                  </Text>
                  <Text size="1" color="gray600">
                    {filter.issueType}
                  </Text>
                </NameCell>,
                <ProtoGuardSeverityBadge severity={filter.severity} />,
                filter.confidence ?? 'n/a',
                filter.issueType
              ],
              details: {
                filter,
                alert: {
                  id: protoGuardAlert.id,
                  runId: protoGuardAlert.runId,
                  sessionId: protoGuardAlert.sessionId,
                  sessionMessageId: protoGuardAlert.sessionMessageId,
                  sessionConnectionId: protoGuardAlert.sessionConnectionId,
                  providerRunId: protoGuardAlert.providerRunId,
                  createdAt: protoGuardAlert.createdAt
                }
              }
            }))}
          />
        ) : (
          <EmptyText>No filter details are available for this alert.</EmptyText>
        )}
      </Section>
    </>
  );
};

let AlertDetailContent = ({
  alert,
  protoGuardAlert
}: {
  alert: ReturnType<typeof useMonitorAlert>;
  protoGuardAlert: ReturnType<typeof useProtoGuardAlert>;
}) => {
  return renderWithLoader({ alert })(({ alert: loadedAlert }) => (
    <PageWrapper>
      {loadedAlert.data.protoGuardAlertId ? (
        renderWithLoader({ protoGuardAlert })(({ protoGuardAlert }) => (
          <ProtoGuardAlertDetail protoGuardAlert={protoGuardAlert.data} />
        ))
      ) : (
        <SchemaChangeAlertDetail alert={loadedAlert.data} />
      )}
    </PageWrapper>
  ));
};

export let AlertPage = () => {
  let instance = useCurrentInstance();
  let { monitorAlertId } = useParams();
  let alert = useMonitorAlert(instance.data?.id, monitorAlertId);
  let protoGuardAlert = useProtoGuardAlert(instance.data?.id, alert.data?.protoGuardAlertId);

  return <AlertDetailContent alert={alert} protoGuardAlert={protoGuardAlert} />;
};
