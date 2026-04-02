import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { useCurrentInstance, usePortal } from '@metorial/state';
import { Button, Spacer, confirm } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import { useNavigate, useParams } from 'react-router-dom';
import { PortalForm } from '../../../scenes/portals/form';

export let PortalSettingsOverviewPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let { portalId } = useParams();
  let portal = usePortal(instance.data?.id, portalId);
  let deleteMutator = portal.useDeleteMutator();

  if (!portalId) return null;

  return renderWithLoader({ portal })(({ portal }) => (
    <>
      <Box title="Portal Settings" description="General settings for this portal.">
        <PortalForm portalId={portal.data.id} />
      </Box>

      <Spacer size={15} />

      <Box title="Delete Portal" description="Permanently delete this portal.">
        <Button
          size="2"
          color="red"
          loading={deleteMutator.isLoading}
          onClick={() =>
            confirm({
              title: 'Delete Portal',
              description: 'Are you sure you want to delete this portal?',
              onConfirm: async () => {
                let [deleted] = await deleteMutator.mutate();
                if (deleted) {
                  navigate(
                    Paths.instance.portals(
                      instance.data?.organization,
                      instance.data?.project,
                      instance.data
                    )
                  );
                }
              }
            })
          }
        >
          Delete Portal
        </Button>
      </Box>
    </>
  ));
};
