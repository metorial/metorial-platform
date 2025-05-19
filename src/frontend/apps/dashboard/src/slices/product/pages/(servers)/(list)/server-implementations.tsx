import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Callout, Spacer } from '@metorial/ui';
import { ServerImplementationsTable } from '../../../scenes/server-implementations/table';

export let ServersImplementationsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Callout color="blue">
        Server implementations allow you to customize and extend the functionality of existing
        MCP servers in the Metorial registry.
      </Callout>

      <Spacer size={25} />

      <ServerImplementationsTable />
    </>
  ));
};
