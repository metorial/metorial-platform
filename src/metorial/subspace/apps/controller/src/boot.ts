export {};

async function main() {
  let { configureProvisionedTenantAppProductionAdapters } = await import(
    '@metorial-subspace/module-auth'
  );
  configureProvisionedTenantAppProductionAdapters();
  await import('./endpoints');
  await import('./connection/server');
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
