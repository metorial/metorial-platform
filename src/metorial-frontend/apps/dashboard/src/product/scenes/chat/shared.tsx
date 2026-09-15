import { useAllProviderListings } from '@metorial/state';
import { Avatar } from '@metorial/ui';
import { useMemo } from 'react';

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

let placeholderNameAdjectives = [
  'brave',
  'calm',
  'clever',
  'cosmic',
  'cozy',
  'crisp',
  'daring',
  'eager',
  'fuzzy',
  'gentle',
  'golden',
  'happy',
  'jolly',
  'kind',
  'lively',
  'lucky',
  'mighty',
  'nimble',
  'proud',
  'quick',
  'quiet',
  'silver',
  'sunny',
  'swift',
  'trusty',
  'vivid',
  'witty'
];

let placeholderNameNouns = [
  'badger',
  'bear',
  'dolphin',
  'eagle',
  'falcon',
  'fox',
  'gecko',
  'hawk',
  'heron',
  'ibex',
  'koala',
  'lemur',
  'lynx',
  'moose',
  'orca',
  'otter',
  'panda',
  'puffin',
  'rabbit',
  'raven',
  'salmon',
  'sparrow',
  'stag',
  'tiger',
  'turtle',
  'whale',
  'wolf'
];

export let generatePlaceholderInstanceName = () => {
  let adjective =
    placeholderNameAdjectives[Math.floor(Math.random() * placeholderNameAdjectives.length)];
  let noun = placeholderNameNouns[Math.floor(Math.random() * placeholderNameNouns.length)];
  let number = Math.floor(Math.random() * 9) + 1;

  return `${adjective}-${noun}-${number}`;
};

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
