import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { ComingSoon } from '../../../../../components/emptyState';
import { CustomServersTable } from '../../../scenes/customServer/table';

export let ManagedServersPage = () => {
  let instance = useCurrentInstance();
  let flags = useDashboardFlags();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      {flags.data?.flags['managed-servers-enabled'] ? (
        <CustomServersTable type="managed" />
      ) : (
        <ComingSoon
          title="Metorial Managed MCP Servers"
          description={
            <>
              Run custom MCP servers managed by Metorial, with all the features you love.
              Deploy them on your own infrastructure or use our managed hosting.
            </>
          }
        />
      )}
    </>
  ));
};
