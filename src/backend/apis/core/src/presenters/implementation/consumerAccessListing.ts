import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { consumerAccessListingType } from '../types';
import { v1MagicMcpServerPreview } from './magicMcpServerPreview';
import { v1ProviderTemplatePreview } from './providerTemplate';

let consumerSurfaceProviderGroupPreviewSchema = v.object({
  id: v.string(),
  name: v.string(),
  description: v.nullable(v.string()),
  index: v.number()
});

export let v1ConsumerAccessListingPresenter = Presenter.create(consumerAccessListingType)
  .presenter(async ({ consumerAccessListing }) => ({
    object: 'consumer.access_listing' as const,
    id: consumerAccessListing.id,
    name: consumerAccessListing.name,
    description: consumerAccessListing.description,
    readme: consumerAccessListing.readme,
    access:
      consumerAccessListing.providerTemplate != null
        ? {
            type: 'provider_template' as const,
            provider_template: v1ProviderTemplatePreview(
              consumerAccessListing.providerTemplate
            )
          }
        : {
            type: 'magic_mcp_server' as const,
            magic_mcp_server: v1MagicMcpServerPreview(consumerAccessListing.magicMcpServer!)
          },
    groups: consumerAccessListing.consumerSurfaceProviderGroups
      .map(membership => membership.consumerSurfaceProviderGroup)
      .sort((a, b) => a.index - b.index)
      .map(group => ({
        id: group.id,
        name: group.name,
        description: group.description,
        index: group.index
      })),
    created_at: consumerAccessListing.createdAt,
    updated_at: consumerAccessListing.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('consumer.access_listing'),
      id: v.string(),
      name: v.string(),
      description: v.nullable(v.string()),
      readme: v.nullable(v.string()),
      access: v.union([
        v.object({
          type: v.literal('provider_template'),
          provider_template: v1ProviderTemplatePreview.schema
        }),
        v.object({
          type: v.literal('magic_mcp_server'),
          magic_mcp_server: v1MagicMcpServerPreview.schema
        })
      ]),
      groups: v.array(consumerSurfaceProviderGroupPreviewSchema),
      created_at: v.date(),
      updated_at: v.date()
    })
  )
  .build();
