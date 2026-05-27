import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Function, FunctionVersion } from '../../prisma/generated/client';
import { db } from '../db';
import { ID, snowflake } from '../id';
import { enqueueEnclaveOverrideClone } from '../queues/enclaveOverride';
import { tenantService } from './tenant';

class enclaveServiceImpl {
  private async getOrCreateEnclave(d: { tenantOid: bigint; identifier: string }) {
    let enclave = await db.enclave.findUnique({
      where: {
        identifier_tenantOid: {
          identifier: d.identifier,
          tenantOid: d.tenantOid
        }
      }
    });
    if (enclave) return enclave;

    return await db.enclave.upsert({
      where: {
        identifier_tenantOid: {
          identifier: d.identifier,
          tenantOid: d.tenantOid
        }
      },
      update: {},
      create: {
        oid: snowflake.nextId(),
        id: await ID.generateId('enclave'),
        name: d.identifier,
        identifier: d.identifier,
        tenantOid: d.tenantOid
      }
    });
  }

  private async ensureEnclaveFunction(d: { enclaveOid: bigint; functionOid: bigint }) {
    let existing = await db.enclaveFunction.findUnique({
      where: {
        enclaveOid_functionOid: d
      }
    });
    if (existing) return existing;

    return await db.enclaveFunction.upsert({
      where: {
        enclaveOid_functionOid: d
      },
      update: {},
      create: {
        oid: snowflake.nextId(),
        enclaveOid: d.enclaveOid,
        functionOid: d.functionOid
      }
    });
  }

  async getEnclaveById(d: { tenantId: string; id: string }) {
    let tenant = await tenantService.getTenantById({ id: d.tenantId });
    let enclave = await db.enclave.findFirst({
      where: {
        OR: [{ id: d.id }, { identifier: d.id }],
        tenantOid: tenant.oid
      }
    });
    if (!enclave) throw new ServiceError(notFoundError('enclave'));
    return enclave;
  }

  async listEnclaves(d: { tenantId: string }) {
    let tenant = await tenantService.getTenantById({ id: d.tenantId });
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.enclave.findMany({
            ...opts,
            where: {
              tenantOid: tenant.oid
            }
          })
      )
    );
  }

  async resolveInvocationOverride(d: {
    enclave: {
      tenantId: string;
      identifier: string;
    };
    function: Function;
    sourceVersion: FunctionVersion;
  }) {
    let tenant = await tenantService.getTenantById({ id: d.enclave.tenantId });

    let enclave = await this.getOrCreateEnclave({
      tenantOid: tenant.oid,
      identifier: d.enclave.identifier
    });

    let [override] = await Promise.all([
      db.enclaveFunctionOverride.findUnique({
        where: {
          enclaveOid_sourceFunctionOid_sourceFunctionVersionOid: {
            enclaveOid: enclave.oid,
            sourceFunctionOid: d.function.oid,
            sourceFunctionVersionOid: d.sourceVersion.oid
          }
        },
        include: {
          overrideFunction: true,
          overrideFunctionVersion: {
            include: {
              runtime: true
            }
          }
        }
      }),
      this.ensureEnclaveFunction({
        enclaveOid: enclave.oid,
        functionOid: d.function.oid
      })
    ]);

    if (override) {
      return {
        enclave,
        function: override.overrideFunction,
        version: override.overrideFunctionVersion
      };
    }

    if (tenant.hasAutomaticEnclaveOverride) {
      await enqueueEnclaveOverrideClone({
        enclaveId: enclave.id,
        functionId: d.function.id,
        sourceFunctionVersionId: d.sourceVersion.id
      });
    }

    return {
      enclave,
      function: d.function,
      version: d.sourceVersion
    };
  }
}

export let enclaveService = Service.create(
  'enclaveService',
  () => new enclaveServiceImpl()
).build();
