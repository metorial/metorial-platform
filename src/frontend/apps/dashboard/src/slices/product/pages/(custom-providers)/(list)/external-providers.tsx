import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { Upgrade } from '../../../../../components/emptyState';
import { CustomProvidersTable } from '../../../scenes/customProvider/table';

export let ExternalProvidersPage = () => {
  let instance = useCurrentInstance();
  let flags = useDashboardFlags();

  return renderWithLoader({ instance, flags })(({ instance, flags }) => (
    <>
      {!flags.data.flags['paid-custom-servers'] ? (
        <Upgrade
          title="External Providers"
          description="Connect external MCP providers to Metorial and enjoy managed OAuth, monitoring and more."
        />
      ) : (
        <CustomProvidersTable type={['remote']} withSearch />
      )}
    </>
  ));
};
