import { Instance, Organization, ProviderOAuthConnection } from '@metorial/db';
import { ServiceError } from '@metorial/error';
import { badRequestError } from '@metorial/error/src/defaultErrors';
import { Service } from '@metorial/service';
import { Tokens } from '@metorial/tokens';
import { addMinutes } from 'date-fns';
import { env } from '../env';

let token = new Tokens({
  secret: env.ticket.PROVIDER_OAUTH_TICKET_SECRET
});

export type OAuthTicket = {
  type: 'oauth.authenticate';
  clientId: string;
  redirectUri: string;
  immediate?: boolean;
};

let type = 'poauth_ticket';

class OauthTicketServiceImpl {
  async createTicket(d: {
    instance: Instance;
    connection: ProviderOAuthConnection;
    redirectUri: string;
    immediate?: boolean;
  }) {
    return token.sign({
      type,
      expiresAt: addMinutes(new Date(), 10),
      data: {
        type: 'oauth.authenticate',
        clientId: d.connection.metorialClientId,
        redirectUri: d.redirectUri,
        immediate: d.immediate
      } satisfies OAuthTicket
    });
  }

  async verifyTicket<Type extends OAuthTicket['type']>(d: {
    ticket: string;
    clientId: string;
    type: Type;
  }): Promise<OAuthTicket & { type: Type }> {
    let res = await token.verify({
      token: d.ticket,
      expectedType: type
    });

    if (!res.verified || res.data.clientId !== d.clientId || res.data.type !== d.type) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid ticket'
        })
      );
    }

    return res.data;
  }

  async getAuthenticationUrl(d: {
    connection: ProviderOAuthConnection;
    redirectUri: string;
    instance: Instance;
    organization: Organization;
    immediate?: boolean;
  }) {
    let ticket = await this.createTicket({
      instance: d.instance,
      connection: d.connection,
      redirectUri: d.redirectUri,
      immediate: d.immediate
    });

    return `${env.ticket.PROVIDER_OAUTH_URL}/provider-oauth/${d.organization.id}/start?ticket=${ticket}&client_id=${d.connection.metorialClientId}`;
  }
}

export let providerOauthTicketService = Service.create(
  'providerOauthTicket',
  () => new OauthTicketServiceImpl()
).build();
