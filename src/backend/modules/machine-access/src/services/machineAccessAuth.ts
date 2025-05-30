import { UnifiedApiKey } from '@metorial/api-keys';
import { Context } from '@metorial/context';
import { db } from '@metorial/db';
import { ServiceError, unauthorizedError } from '@metorial/error';
import { Service } from '@metorial/service';
import { differenceInMinutes } from 'date-fns';

class MachineAccessAuthService {
  async authenticateWithMachineAccessToken(d: { token: string; context: Context }) {
    let parsed = UnifiedApiKey.from(d.token);

    if (parsed) {
      if (parsed.type == 'organization_app_access_token') {
        // TODO: implement this when we add oauth integrations

        throw new ServiceError(
          unauthorizedError({
            message: 'Organization app access tokens are not supported'
          })
        );
      }

      let secret = await db.apiKeySecret.findUnique({
        where: {
          secret: d.token
        },
        include: {
          apiKey: {
            include: {
              machineAccess: {
                include: {
                  organization: true,
                  user: true,
                  instance: { include: { project: true } },
                  actor: true
                }
              }
            }
          }
        }
      });
      if (secret) {
        if (
          secret.apiKey.status != 'active' ||
          secret.apiKey.machineAccess.status != 'active' ||
          (secret.expiresAt && secret.expiresAt < new Date()) ||
          (secret.apiKey.expiresAt && secret.apiKey.expiresAt < new Date())
        ) {
          throw new ServiceError(
            unauthorizedError({
              message: 'API key is expired or has been revoked',
              hint: 'Make sure to use a valid API key from the Metorial dashboard'
            })
          );
        }

        if (
          !secret.apiKey.lastUsedAt ||
          differenceInMinutes(new Date(), secret.apiKey.lastUsedAt) > 30
        ) {
          await db.apiKey.update({
            where: { id: secret.apiKey.id },
            data: { lastUsedAt: new Date() }
          });
        }

        return secret;
      }
    }

    throw new ServiceError(
      unauthorizedError({
        message: 'Invalid API key',
        hint: 'Make sure to use a valid API key from the Metorial dashboard'
      })
    );
  }
}

export let machineAccessAuthService = Service.create(
  'machineAccessAuthService',
  () => new MachineAccessAuthService()
).build();
