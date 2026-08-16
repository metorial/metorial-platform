export let getProjectTenantIdentifier = (project: { oid: bigint }) => `mte-pro-${project.oid}`;
