import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { Text } from '@metorial/ui';
import { Upgrade } from '../../../../../components/emptyState';

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
        <Text size="2" color="gray600">
          External servers have been moved to the provider API.
        </Text>
      )}
    </>
  ));
};
