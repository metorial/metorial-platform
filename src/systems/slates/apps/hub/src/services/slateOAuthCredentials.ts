import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Slate, SlateOAuthCredentials, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { createCredentialsUpdateEventsQueue } from '../queues/instance/credentials';
import { secretService } from './secret';

let include = {
  slate: true
};

class slateOAuthCredentialsServiceImpl {
  async createSlateOAuthCredentials(d: {
    tenant: Tenant;
    input: {
      slate: Slate;
      clientId: string;
      clientSecret: string;
      scopes: string[];
    };
  }) {
    let secret = await secretService.createSecret({
      tenant: d.tenant,
      purpose: 'slate_oauth_credentials',
      secretData: {
        clientId: d.input.clientId,
        clientSecret: d.input.clientSecret
      }
    });

    return await db.slateOAuthCredentials.create({
      data: {
        ...getId('slateOAuthCredentials'),

        slateOid: d.input.slate.oid,
        tenantOid: d.tenant.oid,

        scopes: d.input.scopes,
        clientId: d.input.clientId,
        secretOid: secret.oid
      },
      include
    });
  }

  async updateSlateOAuthCredentials(d: {
    slateOAuthCredentials: SlateOAuthCredentials;
    tenant: Tenant;
    input: {
      clientId?: string;
      clientSecret?: string;
      scopes?: string[];
    };
  }) {
    let secretOid = d.slateOAuthCredentials.secretOid;

    if (d.input.clientSecret || d.input.clientId) {
      let current = await secretService.DANGEROUSLY_decryptSecret({
        secretOid: d.slateOAuthCredentials.secretOid,
        purpose: 'slate_oauth_credentials',
        tenant: d.tenant,
        note: `creds-upd creds:${d.slateOAuthCredentials.id}`
      });

      let secret = await secretService.createSecret({
        tenant: d.tenant,
        purpose: 'slate_oauth_credentials',
        secretData: {
          clientId: d.input.clientId ?? current.clientId,
          clientSecret: d.input.clientSecret ?? current.clientSecret
        }
      });

      secretOid = secret.oid;
    }

    let updated = await db.slateOAuthCredentials.update({
      where: {
        oid: d.slateOAuthCredentials.oid
      },
      data: {
        secretOid: secretOid,
        clientId: d.input.clientId,
        scopes: d.input.scopes
      },
      include
    });

    await createCredentialsUpdateEventsQueue.add({
      credentialsOid: d.slateOAuthCredentials.oid
    });

    return updated;
  }

  async getSlateOAuthCredentialsById(d: { tenant: Tenant; id: string }) {
    let slateOAuthCredentials = await db.slateOAuthCredentials.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.id
      },
      include
    });
    if (!slateOAuthCredentials)
      throw new ServiceError(notFoundError('slate.oauth_credentials'));
    return slateOAuthCredentials;
  }

  async deleteSlateOAuthCredentials(d: {
    tenant: Tenant;
    slateOAuthCredentials: SlateOAuthCredentials;
  }) {
    let setupSecrets = await db.slateInstanceOAuthSetup.findMany({
      where: {
        tenantOid: d.tenant.oid,
        oauthCredentialsOid: d.slateOAuthCredentials.oid
      },
      select: { secretOid: true }
    });

    return await db.$transaction(async db => {
      await db.slateAuthConfig.updateMany({
        where: {
          tenantOid: d.tenant.oid,
          oauthCredentialsOid: d.slateOAuthCredentials.oid
        },
        data: {
          oauthCredentialsOid: null
        }
      });

      for (let secretOid of [
        d.slateOAuthCredentials.secretOid,
        ...setupSecrets.map(setup => setup.secretOid)
      ]) {
        await secretService.DANGEROUSLY_deleteSecret({
          secretOid,
          tenant: d.tenant,
          db
        });
      }

      await db.slateInstanceOAuthSetup.deleteMany({
        where: {
          tenantOid: d.tenant.oid,
          oauthCredentialsOid: d.slateOAuthCredentials.oid
        }
      });

      await db.slateOAuthCredentials.delete({
        where: {
          oid: d.slateOAuthCredentials.oid
        }
      });
    });
  }

  async listSlateOAuthCredentials(d: { tenant: Tenant; slateIds?: string[] }) {
    let slates = d.slateIds
      ? await db.slate.findMany({
          where: {
            id: { in: d.slateIds }
          }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.slateOAuthCredentials.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              slateOid: slates ? { in: slates.map(s => s.oid) } : undefined
            },
            include
          })
      )
    );
  }

  async getManySlateOAuthCredentialsByIds(d: { ids: string[]; tenant: Tenant }) {
    return db.slateOAuthCredentials.findMany({
      where: {
        tenantOid: d.tenant.oid,
        id: { in: d.ids }
      },
      include
    });
  }
}

export let slateOAuthCredentialsService = Service.create(
  'slateOAuthCredentialsService',
  () => new slateOAuthCredentialsServiceImpl()
).build();
