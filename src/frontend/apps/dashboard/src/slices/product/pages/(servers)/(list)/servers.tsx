import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance } from '@metorial/state';
import { Button, Input, Spacer } from '@metorial/ui';
import { SideBox } from '@metorial/ui-product';
import { useState } from 'react';
import { useDebounced } from '../../../../../hooks/useDebounced';
import { ServersGrid } from '../../../scenes/servers/grid';

export let ServersPage = () => {
  let instance = useCurrentInstance();
  let [search, setSearch] = useState('');
  let searchDebounced = useDebounced(search, 500);

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      {/* <PageHeader
        title="Featured Servers"
        description="Explore our collection of featured servers, handpicked for you."
        actions={
          <a href="https://metorial.com/marketplace" target="_blank">
            <Button as="span" size="2">
              Explore More Servers
            </Button>
          </a>
        }
        size="5"
      /> */}

      <Input
        label="Search"
        hideLabel
        placeholder="Search for MCP servers..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <Spacer size={15} />

      <ServersGrid limit={6} orderByRank search={searchDebounced} />

      <Spacer size={15} />

      {(window as any).metorial_enterprise && (
        <SideBox
          title="Request Server"
          description="If you need support for a specific MCP server, please reach out to our team."
        >
          <Button
            as="span"
            size="2"
            onClick={() => {
              // @ts-ignore
              window.metorial_enterprise?.chrome?.showContactSupportModal({
                subject: `Request for MCP Server`,
                message: `Hello Metorial Team,
I would like to request support for a specific MCP server.

Server Name: ...
Server Github URL: ...

Please let me know if you need any additional information from my side.`
              });
            }}
          >
            Request Server
          </Button>
        </SideBox>
      )}

      <Spacer size={15} />

      <a href="https://metorial.com/marketplace" target="_blank">
        <Button as="span" size="3">
          Explore More Servers
        </Button>
      </a>

      {/* <Spacer size={25} />

      <PageHeader title="Your Servers" size="5" />

      <ServersTable limit={6} instanceId={instance.data.id} /> */}
    </>
  ));
};
