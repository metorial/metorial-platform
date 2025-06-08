'use client';

import { ServerListing } from '../../../../../../state/server';

export let NoTools = ({ server }: { server: ServerListing }) => {
  return <p>We have not found any tools for this server yet.</p>;
};
