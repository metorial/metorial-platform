import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { ComingSoon, Upgrade } from '@metorial/empty-state';
import { CustomProvidersGrid } from '../../../scenes/customProvider/table';

export let CustomerProvidersPage = () => {
  let instance = useCurrentInstance();
  let flags = useDashboardFlags();

  return renderWithLoader({ instance, flags })(({ instance, flags }) => (
    <>
      {!flags.data.flags['custom-providers-enabled'] ? (
        <ComingSoon
          title="Custom MCP Servers"
          description="Deploy custom MCP servers on the same reliable infra that runs every MCP server on Metorial. Implement custom behavior or fork existing servers."
        />
      ) : !flags.data.flags['paid-custom-providers'] ? (
        <Upgrade
          title="Custom MCP Servers"
          description="Deploy custom MCP servers on the same reliable infra that runs every MCP server on Metorial. Implement custom behavior or fork existing servers."
        />
      ) : (
        <CustomProvidersGrid type={['function', 'container']} />
      )}
    </>
  ));
};
