import { UnifiedApiKey } from '@metorial/api-keys';
import { getConfig } from '@metorial/config';
import { AccessTag, db, ID, Instance, withTransaction } from '@metorial/db';
import { Service } from '@metorial/service';
import { accessTagService } from './accessTag';

let SESSION_CLIENT_SECRET_POLICY_NAME = 'Session Client Secret Policy';

let includeSessionClientSecretReference = { fineGrainedKey: true } as const;

class SessionClientSecretReferenceService {
  async createForSession(d: { instance: Instance; sessionId: string }) {
    let dbAny = db as any;

    let existing = await dbAny.sessionClientSecretReference.findFirst({
      where: {
        instanceOid: d.instance.oid,
        sessionId: d.sessionId
      },
      include: includeSessionClientSecretReference
    });
    if (existing) {
      return {
        reference: existing,
        clientSecret: existing.fineGrainedKey.secret
      };
    }

    return await withTransaction(async db => {
      let accessTagPolicy = await db.accessTagPolicy.findFirst({
        where: {
          organizationOid: d.instance.organizationOid,
          name: SESSION_CLIENT_SECRET_POLICY_NAME
        }
      });

      if (!accessTagPolicy) {
        accessTagPolicy = await db.accessTagPolicy.create({
          data: {
            id: await ID.generateId('accessTagPolicy'),
            name: SESSION_CLIENT_SECRET_POLICY_NAME,
            organizationOid: d.instance.organizationOid,
            roles: ['instance.provider.session:read']
          }
        });
      }

      let accessTag = await accessTagService.createAccessTag({ instance: d.instance });

      await db.accessTagEntity.create({
        data: {
          accessTagOid: accessTag.oid,
          accessTagPolicyOid: accessTagPolicy.oid,
          subspaceSessionId: d.sessionId
        }
      });

      let secretKey = UnifiedApiKey.create({
        type: 'fine_grained_token',
        config: { url: getConfig().urls.apiUrl, instance: 'v2-us1' }
      });

      let fineGrainedKey = await db.fineGrainedKey.create({
        data: {
          id: await ID.generateId('fineGrainedKey'),
          status: 'active',
          instanceOid: d.instance.oid,
          accessTagOid: (accessTag as AccessTag).oid,
          secret: secretKey.toString(),
          secretRedacted: UnifiedApiKey.redact(secretKey),
          secretLength: secretKey.toString().length
        }
      });

      let reference = await db.sessionClientSecretReference.create({
        data: {
          id: await ID.generateId('sessionClientSecretReference'),
          sessionId: d.sessionId,
          instanceOid: d.instance.oid,
          fineGrainedKeyOid: fineGrainedKey.oid
        },
        include: includeSessionClientSecretReference
      });

      return {
        reference,
        clientSecret: fineGrainedKey.secret
      };
    });
  }

  async getForSession(d: { instance: Instance; sessionId: string }) {
    return await db.sessionClientSecretReference.findFirst({
      where: {
        instanceOid: d.instance.oid,
        sessionId: d.sessionId
      },
      include: includeSessionClientSecretReference
    });
  }

  async getForSessions(d: { instance: Instance; sessionIds: string[] }) {
    if (d.sessionIds.length == 0) return [];

    return await db.sessionClientSecretReference.findMany({
      where: {
        instanceOid: d.instance.oid,
        sessionId: { in: d.sessionIds }
      },
      include: includeSessionClientSecretReference
    });
  }
}

export let sessionClientSecretReferenceService = Service.create(
  'sessionClientSecretReferenceService',
  () => new SessionClientSecretReferenceService()
).build();
