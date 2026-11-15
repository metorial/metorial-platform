import { Avatar, Text } from '@metorial/ui';
import { ItemGrid } from '@metorial/ui-product';
import { styled } from 'styled-components';
import { ProviderAvatarStack } from '../../lib/providerAvatarStack';

let Description = styled.span`
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

export let SkillGridCard = (p: {
  skill: {
    id: string;
    name: string;
    description?: string | null;
    slug: string;
    imageUrl?: string | null;
    providers?: {
      id: string;
      name?: string | null;
      slug: string;
    }[];
  };
  listingLookup: Map<
    string,
    { name: string | null | undefined; imageUrl: string | null | undefined }
  >;
  onClick?: () => void;
  menu?: {
    label: string;
    onClick: () => void;
  }[];
}) => {
  let providers = (p.skill.providers ?? []).map(provider => {
    let listing = p.listingLookup.get(provider.id);

    return {
      id: provider.id,
      name: listing?.name ?? provider.name ?? provider.slug,
      imageUrl: listing?.imageUrl
    };
  });

  return (
    <ItemGrid.Item
      entity={{ id: p.skill.id, hasUsage: true }}
      title={p.skill.name}
      description={
        <Description>{p.skill.description || 'No description provided yet.'}</Description>
      }
      variant="v2"
      height={200}
      onClick={p.onClick}
      menu={p.menu}
      icon={
        providers.length > 0 ? (
          <ProviderAvatarStack
            leading={{ name: p.skill.name, imageUrl: p.skill.imageUrl }}
            providers={providers}
          />
        ) : (
          <Avatar
            entity={{
              name: p.skill.name,
              imageUrl: p.skill.imageUrl
            }}
            size={30}
            imageFit="contain"
          />
        )
      }
      bottom={p.skill.slug ? <Text size="1">{p.skill.slug}</Text> : undefined}
    />
  );
};
