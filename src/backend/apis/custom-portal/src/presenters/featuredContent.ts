import { type ConsumerProviderCatalogItem } from '@metorial/module-consumer';

export let portalFeaturedContentPresenter = (items: ConsumerProviderCatalogItem[]) => ({
  object: 'portal.featured_content' as const,
  items: items.map(item => {
    return item.type == 'provider_template'
      ? {
          type: 'provider_template' as const,
          id: item.id,
          name: item.name,
          description: item.description,
          availability: item.availability
        }
      : {
          type: 'magic_mcp_server' as const,
          id: item.id,
          name: item.name,
          description: item.description,
          availability: item.availability
        };
  })
});
