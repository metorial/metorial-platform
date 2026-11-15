import { canonicalize } from '@lowerdeck/canonicalize';
import { conflictError, notFoundError, ServiceError, validationError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { applyPatch, type JsonValue, PatchError, type PatchOperation } from '@lowerdeck/patch';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  ID,
  Organization,
  OrganizationConfig,
  OrganizationConfigType,
  User,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  getOrganizationConfigDeclaration,
  getOrganizationConfigDeclarations,
  OrganizationConfigDeclaration
} from '../definitions/config';

let maxPatchOperations = 50;

export type MaterializedOrganizationConfig = OrganizationConfig & {
  type: OrganizationConfigType;
  user: User | null;
  organization: Organization | null;
};

class OrganizationConfigService {
  private async syncType(declaration: OrganizationConfigDeclaration) {
    return withTransaction(async db => {
      let type = await db.organizationConfigType.upsert({
        where: { identifier: declaration.identifier },
        create: {
          id: await ID.generateId('organizationConfigType'),
          identifier: declaration.identifier,
          name: declaration.name,
          ownership: declaration.ownership
        },
        update: {
          name: declaration.name
        }
      });

      if (type.ownership !== declaration.ownership) {
        throw new ServiceError(
          conflictError({
            message: `Organization config "${declaration.identifier}" has changed ownership`
          })
        );
      }

      return type;
    });
  }

  private async getTarget(d: {
    declaration: OrganizationConfigDeclaration;
    user: User;
    organization: Organization;
  }) {
    let identity =
      d.declaration.ownership === 'user'
        ? { ownership: 'user', userId: d.user.id }
        : d.declaration.ownership === 'organization'
          ? {
              ownership: 'organization',
              organizationId: d.organization.id
            }
          : {
              ownership: 'user_organization',
              userId: d.user.id,
              organizationId: d.organization.id
            };

    return {
      targetHash: await Hash.sha256(canonicalize(identity)),
      userOid: d.declaration.ownership === 'organization' ? null : d.user.oid,
      organizationOid: d.declaration.ownership === 'user' ? null : d.organization.oid
    };
  }

  private async materialize(d: {
    declaration: OrganizationConfigDeclaration;
    type: OrganizationConfigType;
    user: User;
    organization: Organization;
  }): Promise<MaterializedOrganizationConfig> {
    return withTransaction(async db => {
      let target = await this.getTarget(d);

      return await db.organizationConfig.upsert({
        where: {
          typeOid_targetHash: {
            typeOid: d.type.oid,
            targetHash: target.targetHash
          }
        },
        create: {
          id: await ID.generateId('organizationConfig'),
          typeOid: d.type.oid,
          ...target,
          value: d.declaration.default
        },
        update: {},
        include: { type: true, user: true, organization: true }
      });
    });
  }

  private async resolve(d: { selector: string; user: User; organization: Organization }) {
    return withTransaction(async db => {
      let declarations = getOrganizationConfigDeclarations();
      let targets = await Promise.all(
        declarations.map(async declaration => ({
          declaration,
          target: await this.getTarget({
            declaration,
            user: d.user,
            organization: d.organization
          })
        }))
      );

      let existing = await db.organizationConfig.findFirst({
        where: {
          targetHash: { in: targets.map(target => target.target.targetHash) },
          OR: [
            { id: d.selector },
            { type: { id: d.selector } },
            { type: { identifier: d.selector } }
          ]
        },
        include: { type: true, user: true, organization: true }
      });

      if (existing) {
        let declaration = getOrganizationConfigDeclaration(existing.type.identifier);
        if (declaration) return { declaration, config: existing };
      }

      let types = await Promise.all(
        targets.map(async ({ declaration }) => await this.syncType(declaration))
      );
      let resolved = targets
        .map((target, index) => ({ ...target, type: types[index]! }))
        .find(
          target =>
            target.type.id === d.selector || target.declaration.identifier === d.selector
        );
      if (!resolved) {
        throw new ServiceError(notFoundError('organization_config', d.selector));
      }

      return {
        declaration: resolved.declaration,
        config: await this.materialize({
          declaration: resolved.declaration,
          type: resolved.type,
          user: d.user,
          organization: d.organization
        })
      };
    });
  }

  async listOrganizationConfigs(d: { user: User; organization: Organization }) {
    return withTransaction(async () => {
      let declarations = getOrganizationConfigDeclarations();

      return await Promise.all(
        declarations.map(async declaration => {
          let type = await this.syncType(declaration);

          return await this.materialize({
            declaration,
            type,
            user: d.user,
            organization: d.organization
          });
        })
      );
    });
  }

  async getOrganizationConfig(d: {
    selector: string;
    user: User;
    organization: Organization;
  }) {
    return withTransaction(async () => (await this.resolve(d)).config);
  }

  async getOrganizationConfigOwnership(d: {
    selector: string;
    user: User;
    organization: Organization;
  }) {
    return withTransaction(async () => (await this.resolve(d)).declaration.ownership);
  }

  async setOrganizationConfig(d: {
    selector: string;
    user: User;
    organization: Organization;
    auditScope: AuditScope;
    value: unknown;
  }) {
    return withTransaction(async () => {
      let resolved = await this.resolve(d);

      return await this.write({
        ...d,
        declaration: resolved.declaration,
        config: resolved.config,
        entity: 'value'
      });
    });
  }

  async patchOrganizationConfig(d: {
    selector: string;
    user: User;
    organization: Organization;
    auditScope: AuditScope;
    operations: PatchOperation[];
  }) {
    if (d.operations.length > maxPatchOperations) {
      throw new ServiceError(
        validationError({
          entity: 'operations',
          errors: [
            {
              code: 'too_many_operations',
              message: `A patch can contain at most ${maxPatchOperations} operations`
            }
          ]
        })
      );
    }

    return withTransaction(async db => {
      let resolved = await this.resolve(d);

      // Row lock so concurrent patches apply one after another to the latest value
      let rows = await db.$queryRaw<{ value: JsonValue }[]>`
        SELECT "value" FROM "OrganizationConfig" WHERE "oid" = ${resolved.config.oid} FOR UPDATE
      `;
      let locked = rows[0];
      if (!locked) throw new ServiceError(notFoundError('organization_config', d.selector));

      let config = { ...resolved.config, value: locked.value };

      return await this.write({
        ...d,
        declaration: resolved.declaration,
        config,
        value: this.applyOperations(locked.value, d.operations),
        entity: 'operations'
      });
    });
  }

  private applyOperations(value: JsonValue, operations: PatchOperation[]) {
    try {
      return applyPatch(value, operations);
    } catch (error) {
      if (!(error instanceof PatchError)) throw error;

      throw new ServiceError(
        validationError({
          entity: 'operations',
          errors: [{ code: 'invalid_patch', message: error.message }]
        })
      );
    }
  }

  private async write(d: {
    declaration: OrganizationConfigDeclaration;
    config: MaterializedOrganizationConfig;
    value: unknown;
    entity: 'value' | 'operations';
    user: User;
    organization: Organization;
    auditScope: AuditScope;
  }) {
    return withTransaction(async db => {
      let validation = d.declaration.schema.validate(d.value);

      if (!validation.success) {
        throw new ServiceError(
          validationError({
            entity: d.entity,
            errors: validation.errors
          })
        );
      }

      await Fabric.fire('organization.config.updated:before', {
        organization: d.organization,
        user: d.user,
        config: d.config,
        input: { value: validation.value },
        auditScope: d.auditScope
      });

      let config = await db.organizationConfig.update({
        where: { oid: d.config.oid },
        data: { value: validation.value },
        include: { type: true, user: true, organization: true }
      });

      await Fabric.fire('organization.config.updated:after', {
        organization: d.organization,
        user: d.user,
        config,
        input: { value: validation.value },
        previousConfig: d.config,
        auditScope: d.auditScope
      });

      return config;
    });
  }
}

export let organizationConfigService = Service.create(
  'organizationConfigService',
  () => new OrganizationConfigService()
).build();
