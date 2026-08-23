import type { DashboardInstanceProviderInvocationsGetOutput } from '@metorial/dashboard-sdk';
import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useProviderInvocation, useProviderInvocations } from '@metorial/state';
import { Badge, Callout, Datalist, RenderDate } from '@metorial/ui';
import { RunLogs } from '../../components/runLogs';
import {
  formatTitleCase,
  getStatusBadgeColor,
  isEmptyValue,
  renderJsonCodeBlock
} from './helpers';
import { RequestTraces } from './requestTraces';
import { Card, Section, SectionHeading, SectionList } from './styled';

export type ProviderInvocation = DashboardInstanceProviderInvocationsGetOutput;

export let ProviderInvocationDetails = ({
  invocation,
  hideHeader
}: {
  invocation: ProviderInvocation;
  hideHeader?: boolean;
}) => {
  let hasLogs = invocation.logs.length > 0;
  let hasTraces = invocation.requestTraces?.length > 0;

  return (
    <SectionList>
      {!hideHeader && (
        <Section>
          <SectionHeading>Overview</SectionHeading>
          <Card>
            <Datalist
              items={[
                {
                  label: 'Status',
                  value: (
                    <Badge size="1" color={getStatusBadgeColor(invocation.status)}>
                      {formatTitleCase(invocation.status)}
                    </Badge>
                  )
                },
                {
                  label: 'Type',
                  value: formatTitleCase(
                    invocation.type === 'unknown' ? 'Provider Call' : invocation.type
                  )
                },
                {
                  label: 'Created',
                  value: <RenderDate date={invocation.createdAt} />
                }
              ]}
            />
          </Card>
        </Section>
      )}

      {invocation.error ? (
        <Section>
          <SectionHeading>Error</SectionHeading>
          <Callout color="red">
            <span>
              <strong>{invocation.error.code}</strong> — {invocation.error.message}
            </span>
          </Callout>
        </Section>
      ) : null}

      {invocation.action ? (
        <Section>
          <SectionHeading>Action</SectionHeading>
          <Card>
            <Datalist
              items={[
                { label: 'Name', value: invocation.action.name },
                { label: 'Key', value: invocation.action.key },
                { label: 'ID', value: invocation.action.id }
              ]}
            />
          </Card>
        </Section>
      ) : null}

      {hasLogs ? (
        <Section>
          <SectionHeading>
            <span>Logs</span>
          </SectionHeading>
          <RunLogs logs={invocation.logs} />
        </Section>
      ) : null}

      {hasTraces ? <RequestTraces requestTraces={invocation.requestTraces} /> : null}

      {!hasTraces && !hasLogs && !invocation.action ? (
        <Section>
          <SectionHeading>Activity</SectionHeading>
          <Callout color="gray">
            <span>No request traces, logs, or action data captured for this invocation.</span>
          </Callout>
        </Section>
      ) : null}

      {!isEmptyValue(invocation.attachments) ? (
        <Section>
          <SectionHeading>Attachments</SectionHeading>
          {renderJsonCodeBlock(invocation.attachments)}
        </Section>
      ) : null}
    </SectionList>
  );
};

export let ProviderInvocationById = ({
  providerInvocationId,
  hideHeader
}: {
  providerInvocationId: string;
  hideHeader?: boolean;
}) => {
  let instance = useCurrentInstance();
  let invocation = useProviderInvocation(instance.data?.id, providerInvocationId);

  return renderWithLoader({ invocation })(({ invocation }) => (
    <ProviderInvocationDetails invocation={invocation.data} hideHeader={hideHeader} />
  ));
};

export let ProviderInvocationByCallbackEventId = ({
  callbackEventId,
  hideHeader
}: {
  callbackEventId: string;
  hideHeader?: boolean;
}) => {
  let instance = useCurrentInstance();
  let invocations = useProviderInvocations(instance.data?.id, { callbackEventId });

  return renderWithLoader({ invocations })(({ invocations }) => {
    let invocation = invocations.data.items[0];

    if (!invocation) {
      return (
        <Callout color="gray">
          <span>No provider invocation logs were captured for this callback event.</span>
        </Callout>
      );
    }

    return <ProviderInvocationDetails invocation={invocation} hideHeader={hideHeader} />;
  });
};
