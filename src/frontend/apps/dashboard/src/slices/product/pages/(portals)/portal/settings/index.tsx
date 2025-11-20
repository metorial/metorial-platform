import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, usePortal } from '@metorial/state';
import { Button, confirm, Spacer } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { PortalForm } from '../../../../scenes/portals/form';

export let PortalSettingsOverviewPage = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.id, params.portalId!);

  let deleteMutator = portal.useDeleteMutator();

  return (
    <>
      {renderWithLoader({ portal })(({ portal }) => (
        <>
          <Box title="Portal Settings" description="General settings for this portal.">
            <PortalForm portalId={portal.data.id} />
          </Box>

          <Spacer height={25} />

          <Box title="Delete Portal" description="Permanently delete this portal.">
            <Button
              onClick={() =>
                confirm({
                  title: 'Delete Portal',
                  description:
                    'Are you sure you want to delete this portal? This action cannot be undone.',
                  async onConfirm() {
                    await deleteMutator.mutate({});
                  }
                })
              }
              size="2"
              color="red"
            >
              Delete Portal
            </Button>
          </Box>
        </>
      ))}
    </>
  );
};
