import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Button, Spacer, Title } from '@metorial/ui';
import { ServersGrid } from '../../../scenes/servers/grid';
import { ServersTable } from '../../../scenes/servers/table';

export let ServersPage = () => {
  let instance = useCurrentInstance();

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Title as="h2" size="5" weight="strong">
        Featured Servers
      </Title>
      <Spacer size={15} />

      <ServersGrid
        limit={6}
        categoryIds={['security']} // TODO: replace with featured collection
      />

      <Spacer size={10} />

      <a href="https://metorial.com/servers" target="_blank">
        <Button as="span">Explore More Servers</Button>
      </a>

      <Spacer size={25} />

      <Title as="h2" size="5" weight="strong">
        Your Servers
      </Title>
      <Spacer size={15} />

      <ServersTable limit={6} instanceId={instance.data.id} />
    </>
  ));
};
