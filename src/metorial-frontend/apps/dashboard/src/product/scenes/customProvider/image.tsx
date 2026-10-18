import { useCurrentInstance, useProviderListing } from '@metorial/state';
import { Avatar } from '@metorial/ui';
import { ProviderImage } from '@metorial/ui-product';

export let CustomProviderImage = ({
  providerId,
  name,
  size,
  radius
}: {
  providerId: string | null | undefined;
  name: string;
  size: number;
  radius: number;
}) => {
  let instance = useCurrentInstance();
  let listing = useProviderListing(instance.data?.id, providerId);
  let imageUrl = listing.data?.imageUrl;

  if (!imageUrl && (!providerId || !listing.isLoading)) {
    return <ProviderImage alt={name} size={size} radius={radius} />;
  }

  return (
    <Avatar
      entity={{ name, photoUrl: imageUrl }}
      size={size}
      radius={radius}
      imageFit="contain"
      noTooltip
    />
  );
};
