import { canonicalize } from '@lowerdeck/canonicalize';
import { conflictError, notFoundError, ServiceError, validationError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  ID,
  Organization,
  OrganizationLayout,
  OrganizationLayoutType,
  User,
  withTransaction
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  getOrganizationLayoutDeclaration,
  getOrganizationLayoutDeclarations,
  OrganizationLayoutDeclaration
} from '../definitions/layout';

export type MaterializedOrganizationLayout = OrganizationLayout & {
  type: OrganizationLayoutType;
  user: User | null;
  organization: Organization | null;
};

class OrganizationLayoutService {
  private async syncType(declaration: OrganizationLayoutDeclaration) {
    return withTransaction(async db => {
      let type = await db.organizationLayoutType.upsert({
        where: { identifier: declaration.identifier },
        create: {
          id: await ID.generateId('organizationLayoutType'),
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
            message: `Organization layout "${declaration.identifier}" has changed ownership`
          })
        );
      }

      return type;
    });
  }

  private async getTarget(d: {
    declaration: OrganizationLayoutDeclaration;
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
    declaration: OrganizationLayoutDeclaration;
    type: OrganizationLayoutType;
    user: User;
    organization: Organization;
  }): Promise<MaterializedOrganizationLayout> {
    return withTransaction(async db => {
      let target = await this.getTarget(d);

      return await db.organizationLayout.upsert({
        where: {
          typeOid_targetHash: {
            typeOid: d.type.oid,
            targetHash: target.targetHash
          }
        },
        create: {
          id: await ID.generateId('organizationLayout'),
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
      let declarations = getOrganizationLayoutDeclarations();
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

      let existing = await db.organizationLayout.findFirst({
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
        let declaration = getOrganizationLayoutDeclaration(existing.type.identifier);
        if (declaration) return { declaration, layout: existing };
      }

      let resolved = targets.find(
        target => target.type.id === d.selector || target.declaration.identifier === d.selector
      );
      if (!resolved) {
        throw new ServiceError(notFoundError('organization_layout', d.selector));
      }

      return {
        declaration: resolved.declaration,
        layout: await this.materialize({
          declaration: resolved.declaration,
          type: resolved.type,
          user: d.user,
          organization: d.organization
        })
      };
    });
  }

  async listOrganizationLayouts(d: { user: User; organization: Organization }) {
    return withTransaction(async () => {
      let declarations = getOrganizationLayoutDeclarations();

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

  async getOrganizationLayout(d: {
    selector: string;
    user: User;
    organization: Organization;
  }) {
    return withTransaction(async () => (await this.resolve(d)).layout);
  }

  async getOrganizationLayoutOwnership(d: {
    selector: string;
    user: User;
    organization: Organization;
  }) {
    return withTransaction(async () => (await this.resolve(d)).declaration.ownership);
  }

  async setOrganizationLayout(d: {
    selector: string;
    user: User;
    organization: Organization;
    auditScope: AuditScope;
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

      await Fabric.fire('organization.layout.updated:before', {
        organization: d.organization,
        user: d.user,
        layout: resolved.layout,
        input: { value: validation.value },
        auditScope: d.auditScope
      });

      let layout = await db.organizationLayout.update({
        where: { oid: resolved.layout.oid },
        data: { value: validation.value },
        include: { type: true, user: true, organization: true }
      });

      await Fabric.fire('organization.layout.updated:after', {
        organization: d.organization,
        user: d.user,
        layout,
        input: { value: validation.value },
        previousLayout: resolved.layout,
        auditScope: d.auditScope
      });

      return layout;
    });
  }
}

export let organizationLayoutService = Service.create(
  'organizationLayoutService',
  () => new OrganizationLayoutService()
).build();
