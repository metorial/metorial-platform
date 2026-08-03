import { DashboardInstanceProviderRunsGetOutput } from '@metorial/dashboard-sdk';
import { useCurrentInstance, useProvider, useSessionErrors } from '@metorial/state';
import { Callout, Spacer } from '@metorial/ui';
import { RiServerLine } from '@remixicon/react';
import styled from 'styled-components';
import { Entry } from '../session/components/entry';
import { ItemList } from '../session/components/itemList';
import { ProviderRunLogs } from '../session/components/providerRunLogs';
import { useEvents } from '../session/hooks/useEvents';

let Wrapper = styled.div``;

export let ProviderRunEvents = ({
  providerRun
}: {
  providerRun: DashboardInstanceProviderRunsGetOutput;
}) => {
  let instance = useCurrentInstance();

  let sessionId = providerRun.sessionId;

  let errors = useSessionErrors(providerRun ? instance.data?.id : null, {
    providerRunId: providerRun.id,
    limit: 1
  });
  let error = errors.data?.items[0];

  let eventItems = useEvents(sessionId, {
    providerRunId: providerRun?.id
  });

  let providerId = providerRun.providerId;
  let provider = useProvider(instance.data?.id, providerId);
  let providerName = provider.data?.name ?? providerId ?? 'Unknown';
  let startTime = providerRun.createdAt;
  let endTime = providerRun.completedAt;

  let allItems = [
    {
      component: <Entry title="Provider started" icon={<RiServerLine />} time={startTime} />,
      time: startTime
    },

    ...eventItems.data,

    endTime && {
      component: <Entry title="Provider stopped" icon={<RiServerLine />} time={endTime} />,
      time: endTime
    }
  ];

  return (
    <Wrapper>
      {error && (
        <>
          <Callout color="red">
            Provider run failed with error: {error.message} ({error.code})
          </Callout>
          <Spacer height={20} />
        </>
      )}

      <ItemList items={allItems} />

      <Spacer height={16} />

      <ProviderRunLogs providerRunId={providerRun.id} />
    </Wrapper>
  );
};
