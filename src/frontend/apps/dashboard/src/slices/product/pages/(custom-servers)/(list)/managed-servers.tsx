import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { ComingSoon, Upgrade } from '../../../../../components/emptyState';
import { CustomServersTable } from '../../../scenes/customServer/table';

export let ManagedServersPage = () => {
  let instance = useCurrentInstance();
  let flags = useDashboardFlags();

  return renderWithLoader({ instance, flags })(({ instance, flags }) => (
    <>
      {!flags.data.flags['managed-servers-enabled'] ? (
        <ComingSoon
          title="Managed Providers"
          description="Deploy custom MCP providers on the same reliable infra that runs every MCP provider on Metorial. Implement custom behavior or fork existing providers."
        />
      ) : !flags.data.flags['paid-custom-servers'] ? (
        <Upgrade
          title="Managed Providers"
          description="Deploy custom MCP providers on the same reliable infra that runs every MCP provider on Metorial. Implement custom behavior or fork existing providers."
        />
      ) : (
        <CustomServersTable type={['function', 'container']} withSearch />
      )}
    </>
  ));
};
