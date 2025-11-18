import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, usePortal } from '@metorial/state';
import { Box } from '@metorial/ui-product';
import { useParams } from 'react-router-dom';
import { PortalForm } from '../../../scenes/portals/form';

export let PortalSettingsPage = () => {
  let instance = useCurrentInstance();
  let params = useParams();
  let portal = usePortal(instance.data?.id, params.portalId!);

  return (
    <>
      {renderWithLoader({ portal })(({ portal }) => (
        <Box title="Portal Settings" description="General settings for this portal.">
          <PortalForm portalId={portal.data.id} />
        </Box>
      ))}
    </>
  );
};
