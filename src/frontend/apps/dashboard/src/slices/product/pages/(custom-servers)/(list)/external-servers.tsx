import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { Upgrade } from '../../../../../components/emptyState';
import { CustomServersTable } from '../../../scenes/customServer/table';

export let ExternalServersPage = () => {
  let instance = useCurrentInstance();
  let flags = useDashboardFlags();

  return renderWithLoader({ instance, flags })(({ instance, flags }) => (
    <>
      {!flags.data.flags['paid-custom-servers'] ? (
        <Upgrade
          title="External MCP Servers"
          description="Connect external MCP servers to Metorial and enjoy managed OAuth, monitoring and more."
        />
      ) : (
        <CustomServersTable type="remote" />
      )}
    </>
  ));
};
