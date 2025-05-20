'use client';

import { LinkButton } from '@metorial/ui';
import { ServerListing } from '../../../../../../state/server';
import { useExplorer } from '../components/explorer/context';

export let NoTools = ({ server }: { server: ServerListing }) => {
  let explorer = useExplorer(server);

  return (
    <p>
      Check out the tools provided by <span style={{ fontWeight: 600 }}>{server.name}</span> in{' '}
      <LinkButton onClick={() => explorer.open()}>Explorer</LinkButton>.
    </p>
  );
};
