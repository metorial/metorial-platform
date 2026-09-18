import { useAllProviderListings } from '@metorial/state';
import { Avatar } from '@metorial/ui';
import { useMemo } from 'react';
export { generatePlaceholderInstanceName } from '../../lib/instanceName';

export type ChatProviderPreview = {
  id: string;
  name: string;
  slug?: string;
};

export let capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export let getChatStatusColor = (status: string) => {
  if (status === 'active') return 'green' as const;
  if (status === 'draft') return 'blue' as const;
  if (status === 'archived') return 'orange' as const;
  return 'gray' as const;
};

export let isNotFoundError = (error: unknown) =>
  (error as any)?.response?.status === 404 || (error as any)?.status === 404;

export let useChatProviderListings = (
  instanceId: string | null | undefined,
  providerIds: string[]
) => {
  let sortedProviderIds = useMemo(
    () => [...new Set(providerIds)].sort(),
    [providerIds.join(',')]
  );
  let listings = useAllProviderListings(
    instanceId,
    sortedProviderIds.length ? sortedProviderIds : null
  );

  let lookup = useMemo(() => {
    let map = new Map<string, { name: string; imageUrl: string | null | undefined }>();

    for (let listing of listings.data ?? []) {
      let preview = {
        name: listing.name ?? listing.provider.name,
        imageUrl: listing.imageUrl
      };

      map.set(listing.id, preview);
      map.set(listing.provider.id, preview);
    }

    return map;
  }, [listings.data]);

  return { ...listings, lookup };
};

export let ChatProviderAvatar = (p: {
  provider: ChatProviderPreview | null | undefined;
  listings: Map<string, { name: string; imageUrl: string | null | undefined }>;
  size?: number;
}) => {
  let listing = p.provider ? p.listings.get(p.provider.id) : undefined;
  let name = listing?.name ?? p.provider?.name ?? p.provider?.slug ?? 'Provider';

  return (
    <Avatar
      entity={{ name, photoUrl: listing?.imageUrl ?? undefined }}
      size={p.size ?? 30}
      noTooltip
      imageFit="contain"
    />
  );
};
