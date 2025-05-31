import { ServerRunsGetOutput } from '@metorial/generated';
import { useCurrentInstance, useServerRunErrors } from '@metorial/state';
import { Callout, Spacer } from '@metorial/ui';
import { RiServerLine } from '@remixicon/react';
import { Entry } from '../session/components/entry';
import { ItemList } from '../session/components/itemList';
import { useEvents } from '../session/hooks/useEvents';

export let ServerRunEvents = ({ serverRun }: { serverRun: ServerRunsGetOutput }) => {
  let instance = useCurrentInstance();

  let errors = useServerRunErrors(serverRun ? instance.data?.id : null, {
    serverRunIds: serverRun?.id,
    limit: 1
  });
  let error = errors.data?.items[0];

  let eventItems = useEvents(serverRun?.serverSession.sessionId, {
    serverRunIds: serverRun?.id
  });

  return (
    <>
      {error && (
        <>
          <Callout color="red">
            Server run failed with error: {error.message} ({error.code})
          </Callout>
          <Spacer height={20} />
        </>
      )}

      <ItemList
        items={[
          {
            component: (
              <Entry
                title={`Server run ${serverRun.serverDeployment.name ?? serverRun.server.name} started`}
                icon={<RiServerLine />}
                time={serverRun.startedAt ?? serverRun.createdAt}
              />
            ),
            time: serverRun.startedAt ?? serverRun.createdAt
          },

          serverRun.stoppedAt && {
            component: (
              <Entry
                title={`Server run ${serverRun.serverDeployment.name ?? serverRun.server.name} stopped`}
                icon={<RiServerLine />}
                time={serverRun.startedAt ?? serverRun.createdAt}
              />
            ),
            time: serverRun.stoppedAt
          },

          ...eventItems
        ]}
      />
    </>
  );
};
