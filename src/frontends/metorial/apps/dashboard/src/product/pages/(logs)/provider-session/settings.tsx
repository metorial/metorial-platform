import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, useSession } from '@metorial/state';
import { Attributes, Spacer } from '@metorial/ui';
import { Box, ID } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { DeleteResourceDangerZone } from '../../../scenes/deleteResourceDangerZone';
import { SessionConnectionStatusBadge } from '../../../scenes/providerSessions/table';

export let ProviderSessionSettingsPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  let { sessionId } = useParams();
  let session = useSession(instance.data?.id, sessionId);
  let deleteMutator = session.useDeleteMutator();

  return renderWithLoader({ session })(({ session }) => (
    <>
      <Box title="Session Settings" description="Review the saved details for this session.">
        <Attributes
          itemWidth="250px"
          attributes={[
            { label: 'Name', content: session.data.name || 'Unnamed Session' },
            { label: 'Description', content: session.data.description || '—' },
            {
              label: 'Connection State',
              content: (
                <SessionConnectionStatusBadge connectionStatus={session.data.connectionState} />
              )
            },
            { label: 'Session ID', content: <ID id={session.data.id} /> }
          ]}
        />
      </Box>

      <Spacer size={20} />

      <DeleteResourceDangerZone
        description="Delete this session and remove its provider connections from your instance."
        buttonLabel="Delete Session"
        confirmTitle="Delete session"
        confirmDescription="Are you sure you want to delete this session?"
        loading={deleteMutator.isLoading}
        success={deleteMutator.isSuccess}
        onDelete={async () => {
          let [res] = await deleteMutator.mutate({});
          if (!res) return;

          navigate(
            Paths.instance.providerSessions(
              instance.data?.organization,
              instance.data?.project,
              instance.data
            )
          );
        }}
      />
    </>
  ));
};
