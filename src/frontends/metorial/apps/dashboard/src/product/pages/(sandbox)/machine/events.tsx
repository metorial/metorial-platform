import { renderWithLoader } from '@metorial/data-hooks';
import { DetailsTableLayout } from '@metorial/details-layout';
import { useCurrentInstance } from '@metorial/state';
import { useParams, useSearchParams } from 'react-router-dom';
import { RouterPanel } from '../../../scenes/routerPanel';
import { SandboxMachineEventDetail } from '../../../scenes/sandbox/events/detail';
import { SandboxMachineEventsTable } from '../../../scenes/sandbox/events/table';

export let SandboxMachineEventsPage = () => {
  let instance = useCurrentInstance();
  let { machineId } = useParams();
  let [params, setParams] = useSearchParams();
  return renderWithLoader({ instance })(({ instance }) => (
    <DetailsTableLayout
      title="Events"
      description="Lifecycle changes and runtime events, newest first."
    >
      {machineId && (
        <>
          <SandboxMachineEventsTable
            instanceId={instance.data.id}
            machineId={machineId}
            selectedItemId={params.get('event_id') ?? undefined}
            onItemClick={event =>
              setParams(previous => {
                let next = new URLSearchParams(previous);
                next.set('event_id', event.id);
                return next;
              })
            }
            emptyState="No events match these filters."
          />
          <RouterPanel param="event_id" width={720}>
            {eventId => (
              <SandboxMachineEventDetail
                instanceId={instance.data.id}
                machineId={machineId}
                eventId={eventId}
              />
            )}
          </RouterPanel>
        </>
      )}
    </DetailsTableLayout>
  ));
};
