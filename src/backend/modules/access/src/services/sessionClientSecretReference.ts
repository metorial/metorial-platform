import { Service } from '@mtsrc/service';
import { db, ID, Instance, withTransaction } from '@metorial/db';
import { accessTagService } from './accessTag';
import { fineGrainedKeyService } from './fineGrainedKey';

let SESSION_CLIENT_SECRET_POLICY_NAME = 'Metorial: Session Client Secret Policy';
let SESSION_CLIENT_SECRET_POLICY_SYSTEM_IDENTIFIER = 'session_client_secret';

let includeSessionClientSecretReference = { fineGrainedKey: true } as const;

class SessionClientSecretReferenceService {
  async createForSession(d: { instance: Instance; sessionId: string }) {
    let existing = await db.sessionClientSecretReference.findFirst({
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
          systemIdentifier: SESSION_CLIENT_SECRET_POLICY_SYSTEM_IDENTIFIER
        }
      });

      if (!accessTagPolicy) {
        accessTagPolicy = await db.accessTagPolicy.upsert({
          where: {
            organizationOid_systemIdentifier: {
              systemIdentifier: SESSION_CLIENT_SECRET_POLICY_SYSTEM_IDENTIFIER,
              organizationOid: d.instance.organizationOid
            }
          },
          create: {
            id: await ID.generateId('accessTagPolicy'),
            name: SESSION_CLIENT_SECRET_POLICY_NAME,
            systemIdentifier: SESSION_CLIENT_SECRET_POLICY_SYSTEM_IDENTIFIER,
            organizationOid: d.instance.organizationOid,
            roles: ['instance.provider.session:read']
          },
          update: {}
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

      let { fineGrainedKey } = await fineGrainedKeyService.createFineGrainedKey({
        input: {},
        instance: d.instance,
        accessTag
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
