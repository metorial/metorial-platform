export let getSamlConnectionDefaultRedirectUrl = (d: {
  callbackUrl: string;
  tenantId: string;
  connectionId: string;
}) => {
  let defaultRedirectUrl = new URL(d.callbackUrl);
  defaultRedirectUrl.searchParams.set('tenant_id', d.tenantId);
  defaultRedirectUrl.searchParams.set('connection_id', d.connectionId);
  return defaultRedirectUrl.toString();
};
