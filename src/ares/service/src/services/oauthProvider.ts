import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import type { App, AppOAuthProvider, OAuthProviderType } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';

class OAuthProviderServiceImpl {
  async list(d: { app: App }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.appOAuthProvider.findMany({
            ...opts,
            where: { appOid: d.app.oid }
          })
      )
    );
  }

  async get(d: { providerId: string }) {
    let provider = await db.appOAuthProvider.findUnique({
      where: { id: d.providerId }
    });
    if (!provider) throw new ServiceError(notFoundError('oauthProvider'));
    return provider;
  }

  async create(d: {
    app: App;
    input: {
      provider: OAuthProviderType;
      clientId: string;
      clientSecret: string;
      redirectUri: string;
    };
  }) {
    return await db.appOAuthProvider.create({
      data: {
        ...getId('appOAuthProvider'),
        appOid: d.app.oid,
        provider: d.input.provider,
        clientId: d.input.clientId,
        clientSecret: d.input.clientSecret,
        redirectUri: d.input.redirectUri
      }
    });
  }

  async update(d: {
    provider: AppOAuthProvider;
    input: {
      clientId?: string;
      clientSecret?: string;
      redirectUri?: string;
      enabled?: boolean;
    };
  }) {
    return await db.appOAuthProvider.update({
      where: { oid: d.provider.oid },
      data: {
        clientId: d.input.clientId ?? undefined,
        clientSecret: d.input.clientSecret ?? undefined,
        redirectUri: d.input.redirectUri ?? undefined,
        enabled: d.input.enabled ?? undefined
      }
    });
  }

  async delete(d: { provider: AppOAuthProvider }) {
    await db.appOAuthProvider.delete({ where: { oid: d.provider.oid } });
  }
}

export let oauthProviderService = new OAuthProviderServiceImpl();
