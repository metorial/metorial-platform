import { delay } from '@lowerdeck/delay';
import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { Service } from '@lowerdeck/service';
import type { SlateInstance, Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { snowflake } from '../id';
import { extractExpiresAt } from '../lib/extractExpiresAt';
import { slateErrorService } from './slateError';
import { secretService } from './secret';
import { slateInvocationService } from './slateInvocation';

let include = { secret: true, authMethod: true };

let Sentry = getSentry();

class slateAuthHandlerServiceImpl {
  async getSlateInstanceAuth(d: {
    tenant: Tenant;
    slateInstance?: SlateInstance;
    authConfigId: string;
    minExpirationBuffer: number;
  }) {
    let authConfig = await db.slateAuthConfig.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        id: d.authConfigId
      },
      include
    });
    if (!authConfig) throw new ServiceError(notFoundError('slate.auth_config'));
    if (
      authConfig.instanceOid &&
      d.slateInstance &&
      authConfig.instanceOid !== d.slateInstance.oid
    ) {
      throw new ServiceError(
        badRequestError({
          message: 'This authentication configuration is not valid for the selected provider.'
        })
      );
    }

    let i = 0;
    while (authConfig.isProcessing) {
      await delay(1000);

      authConfig = await db.slateAuthConfig.findFirstOrThrow({
        where: { oid: authConfig.oid },
        include
      });
      if (i++ > 30) {
        throw new ServiceError(
          badRequestError({
            code: 'timeout',
            message: 'Timed out waiting for authentication configuration to be ready.'
          })
        );
      }
    }

    if (d.slateInstance) {
      db.slateAuthConfigUsedForInstance
        .createMany({
          skipDuplicates: true,
          data: {
            oid: snowflake.nextId(),
            configOid: authConfig.oid,
            instanceOid: d.slateInstance.oid
          }
        })
        .catch(err => {
          console.error('Failed to log auth config usage for instance:', err);
          Sentry.captureException(err, {
            extra: { authConfigOid: authConfig.oid, instanceOid: d.slateInstance?.oid }
          });
        });
    }

    let decrypted = await secretService.DANGEROUSLY_decryptSecret({
      secret: authConfig.secret,
      purpose: 'slate_authentication_configuration',
      tenant: d.tenant
    });

    if (authConfig.tokenExpiresAt) {
      let minExpiration = Date.now() + d.minExpirationBuffer;
      let expiredOrExpiring = authConfig.tokenExpiresAt.getTime() < minExpiration;

      if (expiredOrExpiring) {
        if (authConfig.type !== 'oauth_automated') {
          throw new ServiceError(
            badRequestError({
              code: 'authentication_expired',
              message: 'Authentication configuration has expired.'
            })
          );
        }

        if (!authConfig.oauthCredentialsOid) {
          throw new Error('WTF - oauthCredentialsOid is missing on oauth_automated config');
        }

        let oauthCredentials = await db.slateOAuthCredentials.findFirstOrThrow({
          where: { oid: authConfig.oauthCredentialsOid },
          include: { secret: true }
        });
        let oauthDecrypted = await secretService.DANGEROUSLY_decryptSecret({
          secret: oauthCredentials.secret,
          purpose: 'slate_oauth_credentials',
          tenant: d.tenant
        });

        let authMethod = await db.slateAuthMethod.findFirstOrThrow({
          where: { oid: authConfig.authMethodOid },
          include: {
            mostRecentSpecification: true,
            slate: true
          }
        });
        let slate = authMethod.slate;
        let version = await db.slateVersion.findFirstOrThrow({
          where: {
            slateOid: slate.oid,
            oid:
              d.slateInstance?.lockedSlateVersionOid ??
              authMethod.mostRecentSpecification.mostRecentVersionOid ??
              slate.currentVersionOid
          }
        });

        let stack = await slateInvocationService.createInvocation({
          slateVersion: version,
          participants: []
        });
        let res = await slateInvocationService.refreshOAuthToken({
          stack,
          authenticationMethodId: authMethod.key,
          input: decrypted.input ?? {},
          output: decrypted.output ?? {},
          clientId: oauthDecrypted.clientId,
          clientSecret: oauthDecrypted.clientSecret,
          scopes: oauthCredentials.scopes
        });
        await db.slateAuthConfigEvent.createMany({
          data: {
            oid: snowflake.nextId(),
            type:
              res.status === 'error'
                ? 'oauth_token_refresh_failed'
                : 'oauth_token_refresh_completed',
            configOid: authConfig.oid,
            invocationOid: res.invocation.oid
          }
        });
        if (res.status === 'error') {
          slateErrorService
            .recordSlateError({
              type: 'oauth_token_refresh_failed',
              errorCode: res.error.code,
              errorMessage: res.error.message,
              tenantOid: d.tenant.oid,
              slateOid: slate.oid,
              slateVersionOid: version.oid,
              slateInstanceOid: d.slateInstance?.oid,
              invocationOid: res.invocation.oid,
              authConfigOid: authConfig.oid
            })
            .catch(() => {});

          throw new ServiceError(
            badRequestError({
              code: 'oauth_token_refresh_failed',
              message: `Failed to refresh authentication token: ${res.error.message}`
            })
          );
        }

        decrypted.input = res.data.input ?? decrypted.input;
        decrypted.output = res.data.output ?? decrypted.output;

        await secretService.DANGEROUSLY_updateSecret({
          secretOid: authConfig.secretOid,
          purpose: 'slate_authentication_configuration',
          tenant: d.tenant,
          secretData: decrypted
        });

        let tokenExpiresAt = extractExpiresAt(decrypted.output);
        await db.slateAuthConfig.update({
          where: { oid: authConfig.oid },
          data: { tokenExpiresAt }
        });
      }
    }

    return {
      ...decrypted,
      authConfig,
      authMethod: authConfig.authMethod
    };
  }
}

export let slateAuthHandlerService = Service.create(
  'slateAuthHandlerService',
  () => new slateAuthHandlerServiceImpl()
).build();
