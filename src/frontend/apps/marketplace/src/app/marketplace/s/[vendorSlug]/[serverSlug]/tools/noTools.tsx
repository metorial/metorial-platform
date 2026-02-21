'use client';

import { ProviderListing } from '../../../../../../state/provider';

export let NoTools = ({ providerListing }: { providerListing: ProviderListing }) => {
  return <p>We have not found any tools for this server yet.</p>;
};
