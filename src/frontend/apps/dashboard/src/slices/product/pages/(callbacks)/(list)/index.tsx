import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useDashboardFlags } from '@metorial/state';
import { ComingSoon, Upgrade } from '../../../../../components/emptyState';
import { CallbacksList } from '../../../scenes/callbacks/list';

export let CallbacksPage = () => {
  let instance = useCurrentInstance();
  let flags = useDashboardFlags();

  return renderWithLoader({ instance, flags })(({ instance, flags }) => (
    <>
      {!flags.data.flags['paid-callbacks'] ? (
        <Upgrade
          title="Metorial Callbacks"
          description="Callbacks let your MCP servers call your application about interesting events, like new messages or status changes."
        />
      ) : !flags.data.flags['callbacks-enabled'] ? (
        <ComingSoon
          title="Metorial Callbacks"
          description="Callbacks let your MCP servers call your application about interesting events, like new messages or status changes."
        />
      ) : (
        <CallbacksList />
      )}
    </>
  ));
};
