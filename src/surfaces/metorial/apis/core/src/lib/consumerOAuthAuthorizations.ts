import type { ConsumerProfile } from '@metorial/db';
import { consumerPortalGrantService } from '@metorial/module-consumer-oauth';
import { oauthAuthorizationService } from '@metorial/module-machine-access';

import { sortAuthorizations } from './authorizationPaging';

type Status = 'active' | 'revoked';

export let listConsumerAuthorizations = async (d: {
  consumerProfile: ConsumerProfile;
  statuses?: Status[];
}) => {
  let [applications, grants] = await Promise.all([
    oauthAuthorizationService.listAllConsumerOAuthAuthorizations(d),
    consumerPortalGrantService.listGrants(d)
  ]);

  return sortAuthorizations([...applications, ...grants]);
};

export let getConsumerAuthorization = async (d: {
  consumerProfile: ConsumerProfile;
  oauthAuthorizationId: string;
}) =>
  (await consumerPortalGrantService.findGrantById({
    consumerProfile: d.consumerProfile,
    grantId: d.oauthAuthorizationId
  })) ?? (await oauthAuthorizationService.getConsumerOAuthAuthorizationById(d));

export let revokeConsumerAuthorization = async (d: {
  consumerProfile: ConsumerProfile;
  oauthAuthorizationId: string;
  context: Parameters<typeof consumerPortalGrantService.revokeGrant>[0]['context'];
}) => {
  let grant = await consumerPortalGrantService.findGrantById({
    consumerProfile: d.consumerProfile,
    grantId: d.oauthAuthorizationId
  });

  if (grant) {
    return await consumerPortalGrantService.revokeGrant({
      consumerProfile: d.consumerProfile,
      grantId: d.oauthAuthorizationId,
      context: d.context
    });
  }

  return await oauthAuthorizationService.revokeConsumerOAuthAuthorization(d);
};
