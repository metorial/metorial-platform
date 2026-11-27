import {
  useAllIntegrationProviderTemplates,
  useAllPortalAccessListings,
  useAllPortalConsumerAccess,
  useCreateIntegrationProviderTemplate,
  useCreatePortalConsumerAccessQuiet,
  useDeletePortalConsumerAccess,
  useUpdatePortalAccessListing
} from '@metorial/state';

export type PortalShareResource =
  | { type: 'integration'; id: string; name: string; description?: string | null }
  | { type: 'magic_mcp_server'; id: string; name: string; description?: string | null };

export type PortalShareTarget =
  | { type: 'provider_template'; providerTemplateIds: string[] }
  | { type: 'magic_mcp_server'; magicMcpServerId: string };

export let getPortalShareTargetQuery = (target: PortalShareTarget) =>
  target.type == 'magic_mcp_server'
    ? { type: 'magic_mcp_server' as const, magicMcpServerId: target.magicMcpServerId }
    : { type: 'provider_template' as const, providerTemplateId: target.providerTemplateIds };

export let useIntegrationShareTemplates = (
  instanceId: string | null | undefined,
  resource: PortalShareResource
) =>
  useAllIntegrationProviderTemplates(
    resource.type == 'integration' ? instanceId : null,
    resource.type == 'integration' ? { integrationId: resource.id, status: 'active' } : null
  );

export let useResourcePortalShare = (d: {
  instanceId: string;
  portalId: string;
  resource: PortalShareResource;
  target: PortalShareTarget;
}) => {
  let targetQuery = getPortalShareTargetQuery(d.target);
  let hasTarget =
    d.target.type == 'magic_mcp_server' || d.target.providerTemplateIds.length > 0;

  let grants = useAllPortalConsumerAccess(
    hasTarget ? d.instanceId : null,
    d.portalId,
    hasTarget ? targetQuery : null
  );
  let listings = useAllPortalAccessListings(
    hasTarget ? d.instanceId : null,
    d.portalId,
    hasTarget
      ? targetQuery.type == 'magic_mcp_server'
        ? { magicMcpServerId: targetQuery.magicMcpServerId }
        : { providerTemplateId: targetQuery.providerTemplateId }
      : null
  );

  let createTemplate = useCreateIntegrationProviderTemplate();
  let createAccess = useCreatePortalConsumerAccessQuiet();
  let deleteAccess = useDeletePortalConsumerAccess();
  let updateListing = useUpdatePortalAccessListing();

  let loaders: Record<string, typeof grants | typeof listings> = hasTarget
    ? { grants, listings }
    : {};
  let grantList = hasTarget ? (grants.data ?? []) : [];
  let listing = hasTarget ? (listings.data?.[0] ?? null) : null;

  let resolveAccess = async () => {
    if (d.resource.type == 'magic_mcp_server') {
      return { type: 'magic_mcp_server' as const, magicMcpServerId: d.resource.id };
    }

    let listedTemplateId =
      listing?.access.type == 'provider_template' ? listing.access.providerTemplate.id : null;
    let grantedTemplate = grantList.find(grant => grant.access.type == 'provider_template');
    let grantedTemplateId =
      grantedTemplate?.access.type == 'provider_template'
        ? grantedTemplate.access.providerTemplate.id
        : null;
    let providerTemplateId =
      listedTemplateId ??
      grantedTemplateId ??
      (d.target.type == 'provider_template' ? d.target.providerTemplateIds[0] : null);

    if (!providerTemplateId) {
      let [template] = await createTemplate.mutate({
        instanceId: d.instanceId,
        integrationId: d.resource.id,
        name: d.resource.name,
        description: d.resource.description ?? undefined
      });
      if (!template) return null;

      providerTemplateId = template.id;
    }

    return { type: 'provider_template' as const, providerTemplateId };
  };

  let grant = async (consumerGroupId: string) => {
    let access = await resolveAccess();
    if (!access) return false;

    let [created] = await createAccess.mutate({
      instanceId: d.instanceId,
      portalId: d.portalId,
      consumerGroupId,
      name: listing?.name ?? d.resource.name,
      description: listing ? undefined : (d.resource.description ?? null),
      access
    });

    return !!created;
  };

  let revoke = async (consumerAccessId: string) => {
    let [deleted] = await deleteAccess.mutate({
      instanceId: d.instanceId,
      portalId: d.portalId,
      consumerAccessId
    });

    return !!deleted;
  };

  let setDiscoverable = async (isDiscoverable: boolean) => {
    if (!listing) return;

    await updateListing.mutate({
      instanceId: d.instanceId,
      portalId: d.portalId,
      consumerAccessListingId: listing.id,
      isDiscoverable
    });
  };

  return {
    grants: grantList,
    listing,
    loaders,
    grant,
    revoke,
    setDiscoverable,
    isGranting: createTemplate.isLoading || createAccess.isLoading,
    mutators: { createTemplate, createAccess, deleteAccess, updateListing }
  };
};
