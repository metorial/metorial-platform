import {
  authClients,
  metorialEndpoints,
  rest,
  type BootstrappedOrganization,
  type RestClient
} from '@metorial/e2e';

export let refusedToNonAdmins = {
  none: 401,
  member: 403,
  management: 403,
  instance: 404,
  otherSession: 404
};

export let adminOnly = { ...refusedToNonAdmins, session: 200 };

export let outsiderOf = (otherOrg: BootstrappedOrganization) =>
  rest(metorialEndpoints().api, { session: otherOrg.session });

export let adminOnlyClients = (
  org: BootstrappedOrganization,
  member: { clients: { rest: RestClient } },
  otherOrg: BootstrappedOrganization
) => authClients(org, { member: member.clients.rest, otherSession: outsiderOf(otherOrg) });
