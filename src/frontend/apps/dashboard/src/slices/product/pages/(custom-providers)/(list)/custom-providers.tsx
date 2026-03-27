import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { ComingSoon, Upgrade } from '../../../../../components/emptyState';
import { CustomProvidersTable } from '../../../scenes/customProvider/table';

export let CustomerProvidersPage = () => {
  let instance = useCurrentInstance();
  let flags = useDashboardFlags();

  return renderWithLoader({ instance, flags })(({ instance, flags }) => (
    <>
      {!flags.data.flags['custom-providers-enabled'] ? (
        <ComingSoon
          title="Custom Providers"
          description="Deploy custom MCP providers on the same reliable infra that runs every MCP provider on Metorial. Implement custom behavior or fork existing providers."
        />
      ) : !flags.data.flags['paid-custom-providers'] ? (
        <Upgrade
          title="Custom Providers"
          description="Deploy custom MCP providers on the same reliable infra that runs every MCP provider on Metorial. Implement custom behavior or fork existing providers."
        />
      ) : (
        <CustomProvidersTable type={['function', 'container']} />
      )}
    </>
  ));
};
