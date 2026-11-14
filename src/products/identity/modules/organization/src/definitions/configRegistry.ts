import { toTypeScript } from '@lowerdeck/validation';
import type { OrganizationConfigDeclaration } from './config';

let header = `// Generated from the organization config declarations by \`bun run generate:config-types\`.
// Do not edit by hand.`;

export let renderOrganizationConfigRegistry = (
  declarations: OrganizationConfigDeclaration[]
) => {
  let sorted = [...declarations].sort((a, b) => a.identifier.localeCompare(b.identifier));

  let types = sorted
    .map(
      declaration =>
        `${JSON.stringify(declaration.identifier)}: ${toTypeScript(declaration.schema)};`
    )
    .join('\n');

  let defaults = sorted
    .map(
      declaration =>
        `${JSON.stringify(declaration.identifier)}: ${JSON.stringify(declaration.default)},`
    )
    .join('\n');

  return `${header}

export interface OrganizationConfigs {
${types}
}

export type OrganizationConfigKey = keyof OrganizationConfigs;

export let organizationConfigDefaults: OrganizationConfigs = {
${defaults}
};
`;
};
