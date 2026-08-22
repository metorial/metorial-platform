import { renderWithLoader } from '@metorial/data-hooks';
import { ComingSoon, Upgrade } from '@metorial/empty-state';
import { useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { useParams } from 'react-router-dom';
import { IntegrationCallbacksManager } from '../../../scenes/integrations/integrationCallbacks';

export let IntegrationCallbacksPage = () => {
  let instance = useCurrentInstance();
  let flags = useDashboardFlags();
  let { integrationId } = useParams();

  return renderWithLoader({ instance, flags })(({ flags }) => {
    if (!flags.data.flags['callbacks-enabled']) {
      return (
        <ComingSoon
          title="Integration callbacks"
          description="Configure provider triggers and webhook destinations from this integration."
        />
      );
    }

    if (!flags.data.flags['paid-callbacks']) {
      return (
        <Upgrade
          title="Integration callbacks"
          description="Configure provider triggers and webhook destinations from this integration."
        />
      );
    }

    return integrationId ? (
      <IntegrationCallbacksManager integrationId={integrationId} />
    ) : null;
  });
};
