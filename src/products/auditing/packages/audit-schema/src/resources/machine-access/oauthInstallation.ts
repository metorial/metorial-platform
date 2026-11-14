import { v } from '@lowerdeck/validation';
import {
  Instance,
  MachineAccess,
  OAuthApplication,
  OAuthApplicationClientSecret,
  OAuthInstallation,
  Organization,
  OrganizationActor,
  Project,
  User
} from '@metorial/db';
import { oauthInstallationPresenter } from '@metorial/presenters';
import { resource } from '../../_lib/resource';

export let oauthInstallationResource = resource({
  name: 'oauth_installation',
  payload: v.typedAny<{
    oauthInstallation: OAuthInstallation & {
      organization: Organization;
      oauthApplication: OAuthApplication & {
        organization: Organization | null;
        clientSecrets?: OAuthApplicationClientSecret[] | null;
      };
      serverSideMachineAccess:
        | (MachineAccess & {
            organization: Organization | null;
            actor: OrganizationActor | null;
            instance: (Instance & { project: Project }) | null;
            user: User | null;
          })
        | null;
    };
  }>('oauth_installation'),
  presenter: oauthInstallationPresenter,
  actions: {
    create: true,
    update: true,
    revoke: true
  }
});
