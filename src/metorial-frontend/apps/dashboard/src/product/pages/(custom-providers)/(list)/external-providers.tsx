import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { ComingSoon, Upgrade } from '@metorial/empty-state';
import { CustomProvidersGrid } from '../../../scenes/customProvider/table';

export let ExternalProvidersPage = () => {
  let instance = useCurrentInstance();
  let flags = useDashboardFlags();

  return renderWithLoader({ instance, flags })(({ instance, flags }) => (
    <>
      {!flags.data.flags['custom-providers-enabled'] ? (
        <ComingSoon
          title="Remote MCP Servers"
          description="Connect remote MCP servers to Metorial and enjoy managed OAuth, monitoring and more."
        />
      ) : !flags.data.flags['paid-custom-providers'] ? (
        <Upgrade
          title="Remote MCP Servers"
          description="Connect remote MCP servers to Metorial and enjoy managed OAuth, monitoring and more."
        />
      ) : (
        <CustomProvidersGrid type={['remote']} />
      )}
    </>
  ));
};
