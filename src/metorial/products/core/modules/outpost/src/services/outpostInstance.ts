import { Service } from '@lowerdeck/service';
import { createSystemAuditScope } from '@metorial/audit-scope';
import {
  db,
  ID,
  Organization,
  Outpost,
  OutpostCredential,
  OutpostInstance,
  OutpostService,
  withTransaction,
  type TransactionDB
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import type { RequestedService, ResolvedService } from '@metorial-outpost/server';
import { OUTPOST_INSTANCE_TOKEN_TTL_MS } from '../lib/constants';
import { OUTPOST_SERVICES, type OutpostServiceName } from '../lib/services';

export type InstanceAuthorizationStatus =
  | 'active'
  | 'unknown'
  | 'instance_disabled'
  | 'outpost_disabled';

let isKnownService = (id: string): id is OutpostServiceName =>
  (OUTPOST_SERVICES as readonly string[]).includes(id);

let sameBytes = (a: Uint8Array, b: Uint8Array) =>
  a.length == b.length && a.every((byte, index) => byte == b[index]);

class OutpostInstanceService {
  async registerInstance(d: {
    outpost: Outpost;
    credential: OutpostCredential;
    organization: Organization;
    input: {
      identifier: string;
      publicKey: Uint8Array;
      requestedServices: RequestedService[];
    };
    context?: { ip?: string };
  }) {
    let now = new Date();
    let expiresAt = new Date(now.getTime() + OUTPOST_INSTANCE_TOKEN_TTL_MS);

    let auditScope = this.auditScope(d.organization, {
      outpostId: d.outpost.id,
      instanceIdentifier: d.input.identifier,
      ip: d.context?.ip ?? null
    });

    let grantedServices = await this.resolveGrantedServices({ outpost: d.outpost });

    let fabricInput = {
      identifier: d.input.identifier,
      requestedServices: d.input.requestedServices
    };

    return await withTransaction(async tdb => {
      await Fabric.fire('outpost_instance.registered:before', {
        outpost: d.outpost,
        credential: d.credential,
        organization: d.organization,
        input: fabricInput,
        auditScope
      });

      let previousInstance = await tdb.outpostInstance.findUnique({
        where: {
          outpostOid_identifier: {
            outpostOid: d.outpost.oid,
            identifier: d.input.identifier
          }
        }
      });

      let instance = await tdb.outpostInstance.upsert({
        where: {
          outpostOid_identifier: {
            outpostOid: d.outpost.oid,
            identifier: d.input.identifier
          }
        },
        create: {
          id: await ID.generateId('outpostInstance'),
          status: 'active',
          outpostOid: d.outpost.oid,
          credentialOid: d.credential.oid,
          identifier: d.input.identifier,
          publicKey: Buffer.from(d.input.publicKey),
          registrationCount: 1,
          lastRegisteredAt: now,
          lastSeenAt: now,
          lastSeenIp: d.context?.ip,
          expiresAt
        },
        update: {
          status: 'active',
          credentialOid: d.credential.oid,
          publicKey: Buffer.from(d.input.publicKey),
          registrationCount: { increment: 1 },
          lastRegisteredAt: now,
          lastSeenAt: now,
          lastSeenIp: d.context?.ip,
          expiresAt
        }
      });

      if (
        previousInstance &&
        !sameBytes(new Uint8Array(previousInstance.publicKey), d.input.publicKey)
      ) {
        await tdb.outpostInstanceKeyRotation.create({
          data: {
            id: await ID.generateId('outpostInstanceKeyRotation'),
            instanceOid: instance.oid,
            publicKey: Buffer.from(d.input.publicKey)
          }
        });

        instance = await tdb.outpostInstance.update({
          where: { oid: instance.oid },
          data: {
            keyRotationCount: { increment: 1 },
            lastKeyRotationAt: now
          }
        });

        await Fabric.fire('outpost_instance.key_rotated:after', {
          instance,
          previousInstance,
          outpost: d.outpost,
          organization: d.organization,
          auditScope
        });
      }

      let services = await this.reconcileServices(tdb, {
        instance,
        requestedServices: d.input.requestedServices,
        grantedServices
      });

      await this.refreshOutpostConnection(tdb, { outpost: d.outpost, now });

      await Fabric.fire('outpost_instance.registered:after', {
        instance,
        previousInstance,
        services,
        outpost: d.outpost,
        credential: d.credential,
        organization: d.organization,
        input: fabricInput,
        auditScope
      });

      return {
        instance,
        services: this.decisions({
          requestedServices: d.input.requestedServices,
          grantedServices
        }),
        instanceTokenExpiresAt: expiresAt
      };
    });
  }

  async getInstanceAuthorization(d: {
    outpostId: string;
    instanceId: string;
    credentialId: string;
  }): Promise<InstanceAuthorizationStatus> {
    let instance = await db.outpostInstance.findFirst({
      where: {
        identifier: d.instanceId,
        outpost: { id: d.outpostId },
        credential: { id: d.credentialId }
      },
      include: { outpost: true, credential: true }
    });
    if (!instance) return 'unknown';

    if (instance.outpost.status != 'active') return 'outpost_disabled';
    if (instance.credential.status != 'active') return 'instance_disabled';
    if (instance.status != 'active') return 'instance_disabled';

    return 'active';
  }

  async deactivateInstance(d: {
    instance: OutpostInstance;
    outpost: Outpost;
    organization: Organization;
  }) {
    return await withTransaction(async tdb => {
      let instance = await tdb.outpostInstance.update({
        where: { oid: d.instance.oid },
        data: { status: 'inactive' }
      });

      await this.refreshOutpostConnection(tdb, { outpost: d.outpost });

      await Fabric.fire('outpost_instance.deactivated:after', {
        instance,
        previousInstance: d.instance,
        outpost: d.outpost,
        organization: d.organization,
        auditScope: this.auditScope(d.organization, { outpostId: d.outpost.id })
      });

      return instance;
    });
  }

  async deleteInstance(d: {
    instance: OutpostInstance;
    outpost: Outpost;
    organization: Organization;
  }) {
    await withTransaction(async tdb => {
      await tdb.outpostInstance.delete({ where: { oid: d.instance.oid } });

      await this.refreshOutpostConnection(tdb, { outpost: d.outpost });

      await Fabric.fire('outpost_instance.deleted:after', {
        instance: d.instance,
        outpost: d.outpost,
        organization: d.organization,
        auditScope: this.auditScope(d.organization, { outpostId: d.outpost.id })
      });
    });
  }

  async refreshOutpostConnection(tdb: TransactionDB, d: { outpost: Outpost; now?: Date }) {
    let instanceCount = await tdb.outpostInstance.count({
      where: { outpostOid: d.outpost.oid, status: 'active' }
    });

    return await tdb.outpost.update({
      where: { oid: d.outpost.oid },
      data: {
        instanceCount,
        connectionStatus: instanceCount > 0 ? 'active' : 'inactive',
        ...(d.now ? { lastSeenAt: d.now } : {})
      }
    });
  }

  private async resolveGrantedServices(d: { outpost: Outpost }): Promise<Set<OutpostService>> {
    if (d.outpost.status != 'active') return new Set();

    let access = await db.outpostAccess.findMany({
      where: { outpostOid: d.outpost.oid },
      select: { services: true }
    });

    return new Set(access.flatMap(entry => entry.services));
  }

  private decisions(d: {
    requestedServices: RequestedService[];
    grantedServices: Set<OutpostService>;
  }): ResolvedService[] {
    return d.requestedServices.map(service => ({
      id: service.id,
      granted:
        isKnownService(service.id) &&
        d.grantedServices.has(service.id as unknown as OutpostService)
    }));
  }

  private async reconcileServices(
    tdb: TransactionDB,
    d: {
      instance: OutpostInstance;
      requestedServices: RequestedService[];
      grantedServices: Set<OutpostService>;
    }
  ) {
    let unknownServices = d.requestedServices.filter(service => !isKnownService(service.id));
    if (unknownServices.length > 0) {
      console.warn('outpost_instance: ignoring unknown declared services', {
        instanceId: d.instance.id,
        services: unknownServices.map(service => service.id)
      });
    }

    let known = d.requestedServices.filter(service => isKnownService(service.id));

    await tdb.outpostInstanceService.deleteMany({
      where: {
        instanceOid: d.instance.oid,
        service: {
          notIn: known.map(service => service.id as unknown as OutpostService)
        }
      }
    });

    return await Promise.all(
      known.map(async service => {
        let enumService = service.id as unknown as OutpostService;

        return await tdb.outpostInstanceService.upsert({
          where: {
            instanceOid_service: { instanceOid: d.instance.oid, service: enumService }
          },
          create: {
            id: await ID.generateId('outpostInstanceService'),
            instanceOid: d.instance.oid,
            service: enumService,
            version: service.version,
            capabilities: service.capabilities ?? {},
            granted: d.grantedServices.has(enumService)
          },
          update: {
            version: service.version ?? null,
            capabilities: service.capabilities ?? {},
            granted: d.grantedServices.has(enumService)
          }
        });
      })
    );
  }

  private auditScope(
    organization: Organization,
    metadata: Record<string, string | number | boolean | null>
  ) {
    return createSystemAuditScope({
      organization,
      job: 'outpost_instance_registration',
      metadata,
      context: { ip: (metadata.ip as string) || '0.0.0.0', ua: 'Metorial Outpost' }
    });
  }
}

export let outpostInstanceService = Service.create(
  'outpostInstanceService',
  () => new OutpostInstanceService()
).build();
