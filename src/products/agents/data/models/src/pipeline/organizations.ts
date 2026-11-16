import { titleCase } from '../lib/util';
import { normalizeKey } from '../normalize/parseName';
import { organizationSeeds } from '../registry/organizations';
import type { ModelsDevSnapshot } from '../sources/modelsDev';
import type { Organization, OrganizationRole } from '../types';

export interface OrganizationIndex {
  organizations: Map<string, Organization>;
  logoSources: Map<string, string>;
  resolveOrg: (alias: string) => string | null;
  resolveLab: (alias: string) => string | null;
  labForUpstream: (modelsDevLabId: string) => string;
  ensure: (opts: {
    id: string;
    name: string;
    role: OrganizationRole;
    alias?: string;
  }) => Organization;
  addRole: (id: string, role: OrganizationRole) => void;
}

let aliasForms = (value: string) => {
  let key = normalizeKey(value);
  return [value.toLowerCase(), key, key.replace(/-/g, '')];
};

export let buildOrganizations = (snapshot: ModelsDevSnapshot): OrganizationIndex => {
  let organizations = new Map<string, Organization>();
  let aliases = new Map<string, string>();
  let logoSources = new Map<string, string>();
  let upstreamLabs = new Map<string, string>();

  let addAlias = (alias: string, id: string) => {
    for (let form of aliasForms(alias)) if (!aliases.has(form)) aliases.set(form, id);
  };

  let resolveOrg = (alias: string) => {
    for (let form of aliasForms(alias)) {
      let id = aliases.get(form);
      if (id) return id;
    }
    return null;
  };

  let addRole = (id: string, role: OrganizationRole) => {
    let org = organizations.get(id);
    if (org && !org.roles.includes(role)) org.roles = [...org.roles, role].sort();
  };

  let ensure: OrganizationIndex['ensure'] = ({ id, name, role, alias }) => {
    let existing = organizations.get(id);
    if (!existing) {
      existing = {
        id,
        name,
        roles: [],
        aliases: [],
        description: null,
        website: null,
        logo: null,
        country: null,
        status: 'active'
      };
      organizations.set(id, existing);
      addAlias(id, id);
    }

    if (alias && alias !== id) {
      addAlias(alias, id);
      if (!existing.aliases.includes(alias))
        existing.aliases = [...existing.aliases, alias].sort();
    }

    addRole(id, role);
    return existing;
  };

  for (let seed of organizationSeeds) {
    organizations.set(seed.id, {
      id: seed.id,
      name: seed.name,
      roles: [],
      aliases: [...(seed.aliases ?? [])].sort(),
      description: null,
      website: seed.website ?? null,
      logo: null,
      country: seed.country ?? null,
      status: 'active'
    });

    addAlias(seed.id, seed.id);
    for (let alias of seed.aliases ?? []) addAlias(alias, seed.id);
  }

  for (let lab of snapshot.labs) {
    let id = resolveOrg(lab.id) ?? normalizeKey(lab.id);
    let org = ensure({ id, name: lab.name ?? titleCase(lab.id), role: 'lab', alias: lab.id });

    org.description = org.description ?? lab.description;
    upstreamLabs.set(lab.id, id);

    if (lab.logoPath && !org.logo) {
      org.logo = `logos/organizations/${id}.svg`;
      logoSources.set(org.logo, lab.logoPath);
    }
  }

  for (let labModel of snapshot.labModels) {
    if (upstreamLabs.has(labModel.labId)) continue;

    let id = resolveOrg(labModel.labId) ?? normalizeKey(labModel.labId);
    ensure({ id, name: titleCase(labModel.labId), role: 'lab', alias: labModel.labId });
    upstreamLabs.set(labModel.labId, id);
  }

  let resolveLab = (alias: string) => {
    let id = resolveOrg(alias);
    return id && organizations.get(id)?.roles.includes('lab') ? id : null;
  };

  let labForUpstream = (modelsDevLabId: string) =>
    upstreamLabs.get(modelsDevLabId) ??
    resolveOrg(modelsDevLabId) ??
    normalizeKey(modelsDevLabId);

  return {
    organizations,
    logoSources,
    resolveOrg,
    resolveLab,
    labForUpstream,
    ensure,
    addRole
  };
};
