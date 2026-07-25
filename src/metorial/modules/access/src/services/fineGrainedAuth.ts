import { ServiceError, unauthorizedError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { UnifiedApiKey } from '@metorial/api-keys';
import { Context } from '@metorial/context';
import { db } from '@metorial/db';
import { differenceInMinutes } from 'date-fns';
import { getScopeDefinition, Scope, scopes } from '../definitions';
import type { FineGrainedAccessTagGrant } from './authentication';

type FineGrainedAuthResult = Awaited<
  ReturnType<FineGrainedAuthService['authenticateWithFineGrainedToken']>
>;

class FineGrainedAuthService {
  async authenticateWithFineGrainedToken(d: { token: string; context: Context }) {
    let parsed = UnifiedApiKey.from(d.token);
    if (!parsed || parsed.type != 'fine_grained_token') {
      throw new ServiceError(
        unauthorizedError({
          message: 'Invalid API key',
          hint: 'Make sure to use a valid API key from the Metorial dashboard'
        })
      );
    }

    let fineGrainedKey = await db.fineGrainedKey.findUnique({
      where: {
        secret: d.token
      },
      include: {
        instance: {
          include: {
            project: true,
            organization: true,
            resourceTenant: true,
            resourceGroup: true
          }
        },
        accessTag: {
          include: {
            accessTagEntities: {
              include: {
                accessTagPolicy: true
              }
            }
          }
        }
      }
    });

    if (!fineGrainedKey) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Invalid API key',
          hint: 'Make sure to use a valid API key from the Metorial dashboard'
        })
      );
    }

    if (
      fineGrainedKey.status != 'active' ||
      (fineGrainedKey.expiresAt && fineGrainedKey.expiresAt < new Date())
    ) {
      throw new ServiceError(
        unauthorizedError({
          message: 'API key is expired or has been revoked',
          hint: 'Make sure to use a valid API key from the Metorial dashboard'
        })
      );
    }

    if (
      !fineGrainedKey.lastUsedAt ||
      differenceInMinutes(new Date(), fineGrainedKey.lastUsedAt) > 30
    ) {
      await db.fineGrainedKey.update({
        where: { oid: fineGrainedKey.oid },
        data: { lastUsedAt: new Date() }
      });
    }

    let accessTagGrants = fineGrainedKey.accessTag.accessTagEntities.flatMap(entity => {
      if (!entity.subspaceSessionId) return [];

      return [
        {
          resourceType: 'subspace.session' as const,
          resourceId: entity.subspaceSessionId,
          roles: entity.accessTagPolicy.roles.filter((role): role is Scope =>
            scopes.includes(role as Scope)
          )
        } satisfies FineGrainedAccessTagGrant
      ];
    });

    let directScopes = new Set(
      fineGrainedKey.accessTag.accessTagEntities.flatMap(entity =>
        entity.accessTagPolicy.roles.filter((role): role is Scope =>
          scopes.includes(role as Scope)
        )
      )
    );
    let orgScopes = new Set<Scope>();
    for (let scope of directScopes) {
      orgScopes.add(scope);
      for (let dep of getScopeDefinition(scope).dependencies) {
        orgScopes.add(dep);
      }
    }

    return {
      fineGrainedKey,
      orgScopes: Array.from(orgScopes),
      accessTagGrants
    };
  }
}

export type FineGrainedAuthInfo = FineGrainedAuthResult;

export let fineGrainedAuthService = Service.create(
  'fineGrainedAuthService',
  () => new FineGrainedAuthService()
).build();
