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
          title="Managed MCP Servers"
          description="Deploy custom MCP servers on the same reliable infra that runs every MCP server on Metorial. Implement custom behavior or fork existing servers."
        />
      ) : !flags.data.flags['paid-custom-servers'] ? (
        <Upgrade
          title="Managed MCP Servers"
          description="Deploy custom MCP servers on the same reliable infra that runs every MCP server on Metorial. Implement custom behavior or fork existing servers."
        />
      ) : (
        <CustomServersTable type="managed" />
      )}
    </>
  ));
};
