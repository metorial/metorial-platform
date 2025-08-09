import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Callout, Spacer } from '@metorial/ui';
import { ServerImplementationsTable } from '../../../scenes/serverImplementations/table';

export let ServersImplementationsPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Callout color="gray">
        Server implementations allow you to customize and extend the functionality of existing
        MCP servers in the Metorial registry. By default, they are created automatically for
        you by Metorial.
      </Callout>

      <Spacer size={25} />

      <ServerImplementationsTable />
    </>
  ));
};
