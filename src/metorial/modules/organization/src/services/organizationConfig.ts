import { canonicalize } from '@lowerdeck/canonicalize';
import { conflictError, notFoundError, ServiceError, validationError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import { Context } from '@metorial/context';
import {
  ID,
  Organization,
  OrganizationActor,
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
      let types = await Promise.all(
        declarations.map(async declaration => ({
          declaration,
          type: await this.syncType(declaration)
        }))
      );
      let targets = await Promise.all(
        types.map(async ({ declaration, type }) => ({
          declaration,
          type,
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

      let resolved = targets.find(
        target => target.type.id === d.selector || target.declaration.identifier === d.selector
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
    performedBy: OrganizationActor;
    context: Context;
    value: unknown;
  }) {
    return withTransaction(async db => {
      let resolved = await this.resolve(d);
      let validation = resolved.declaration.schema.validate(d.value);

      if (!validation.success) {
        throw new ServiceError(
          validationError({
            entity: 'value',
            errors: validation.errors
          })
        );
      }

      await Fabric.fire('organization.config.updated:before', {
        organization: d.organization,
        user: d.user,
        config: resolved.config,
        performedBy: d.performedBy,
        context: d.context,
        input: { value: validation.value }
      });

      let config = await db.organizationConfig.update({
        where: { oid: resolved.config.oid },
        data: { value: validation.value },
        include: { type: true, user: true, organization: true }
      });

      await Fabric.fire('organization.config.updated:after', {
        organization: d.organization,
        user: d.user,
        config,
        performedBy: d.performedBy,
        context: d.context,
        input: { value: validation.value }
      });

      return config;
    });
  }
}

export let organizationConfigService = Service.create(
  'organizationConfigService',
  () => new OrganizationConfigService()
).build();
