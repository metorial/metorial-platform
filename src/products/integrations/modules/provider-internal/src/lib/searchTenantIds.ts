export let getProviderSearchTenantIds = (provider: {
  access: string;
  ownerTenant?: { id: string } | null;
}) => (provider.access == 'tenant' ? [provider.ownerTenant?.id ?? '$$NONE$$'] : []);
