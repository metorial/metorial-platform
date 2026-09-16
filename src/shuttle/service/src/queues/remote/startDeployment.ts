import { delay } from '@lowerdeck/delay';
import { isServiceError } from '@lowerdeck/error';
import { createQueue, QueueRetryError } from '@lowerdeck/queue';
import { encode } from '@toon-format/toon';
import type {
  RemoteOAuthConfig,
  RemoteOAuthDiscoveryDocument,
  ServerRemoteProtocol
} from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import { getId } from '../../id';
import { DeploymentManager } from '../../lib/deployment';
import { versionIdentifier } from '../../lib/identifier/version';
import { OAuthDiscovery } from '../../lib/oauth/discovery';
import { oauthConfigValidator, type OAuthConfiguration } from '../../lib/oauth/types';
import { checkRemote } from '../../lib/remote/check';
import {
  remoteOAuthDiscoveryService,
  remoteOAuthRegistrationService,
  serverOAuthCredentialsService
} from '../../services';
import { deployServerFailedQueue } from '../deployment/failed';
import { deployServerSucceededQueue } from '../deployment/succeeded';
import { discoverRemoteOAuthConfigQueue } from '../discovery/remoteOAuthConfig';
import { retryFailedRegistrationsSearchQueue } from '../discovery/retryRemoteOAuthConnections';
import { serverVersionCreatedQueue } from '../lifecycle/serverVersion';
import { rotateStaleCredentialsSearchQueue } from '../oauth/rotateRemoteCredentials';

export let deployRemoteServerStartQueue = createQueue<{
  serverDeploymentId: string;

  remoteUrl: string;
  remoteProtocol: ServerRemoteProtocol;

  oauthConfig: OAuthConfiguration | undefined;
  preflightOAuthRegistration?: boolean;
}>({
  name: 'shut/rem-ser/deploy/start',
  redisUrl: env.service.REDIS_URL
});

export let deployRemoteServerStartQueueProcessor = deployRemoteServerStartQueue.process(
  async data => {
    let deployment = await db.serverDeployment.findFirst({
      where: { id: data.serverDeploymentId },
      include: { server: true, tenant: true }
    });
    if (!deployment) throw new QueueRetryError();
    let server = deployment.server;

    let dep = await DeploymentManager.of({ serverDeployment: deployment });

    let startingStep = await dep.step('started');
    startingStep.log('Starting MCP server deployment with Metorial Shuttle.');
    await db.serverDeployment.update({
      where: { id: data.serverDeploymentId },
      data: {
        status: 'deploying',
        startedAt: startingStep.step.startedAt
      }
    });
    await startingStep.succeed();

    let deployingStep = await dep.step('deploying');

    try {
      let url = new URL(data.remoteUrl);

      let checkRes = await checkRemote(data.remoteUrl);
      if (!checkRes.ok) {
        deployingStep.log(`Remote server check failed for URL ${data.remoteUrl}.`);
        deployingStep.log(`Error: ${checkRes.errorMessage}`);
        deployingStep.log(
          `Status Code: ${checkRes.error.status} - ${checkRes.error.statusText}`
        );
        deployingStep.log(`Response: ${String(checkRes.error.data).substring(0, 1000)}`);
        throw new Error('Remote server check failed');
      }

      let oauthConfig: RemoteOAuthConfig | null = null;
      let remoteServerNeedsManualAuthentication = false;

      let config: OAuthConfiguration | undefined = undefined;
      let discovery: RemoteOAuthDiscoveryDocument | undefined = undefined;

      if (data.oauthConfig) {
        let valRes = oauthConfigValidator.validate(data.oauthConfig);
        if (!valRes.success) {
          deployingStep.log(`Invalid OAuth configuration provided.`);
          valRes.errors.forEach(err => {
            deployingStep.log(`Error: ${err}`);
          });
          throw new Error('Invalid OAuth configuration provided');
        }

        config = data.oauthConfig as OAuthConfiguration;
      } else {
        let newDiscovery =
          await remoteOAuthDiscoveryService.discoverOauthConfigWithoutRegistrationSafe({
            discoveryUrl: data.remoteUrl
          });
        if (newDiscovery) {
          config = newDiscovery.config;
          discovery = newDiscovery;
        }
      }

      if (config) {
        oauthConfig = await db.remoteOAuthConfig.create({
          data: {
            ...getId('remoteOAuthConfig'),
            discoverStatus: 'discovering',
            name: server.name,
            config,
            providerName: discovery?.providerName ?? url.hostname,
            providerUrl: discovery?.providerUrl ?? url.origin,
            discoveryUrl: discovery?.discoveryUrl,
            scopes: config.scopes_supported ?? [],
            serverOid: server.oid,
            oauthDiscoveryDocumentOid: discovery?.oid
          }
        });

        await discoverRemoteOAuthConfigQueue.add({ oauthConfigId: oauthConfig!.id });

        for (let i = 0; i < 50; i++) {
          oauthConfig = await db.remoteOAuthConfig.findUniqueOrThrow({
            where: { oid: oauthConfig!.oid }
          });
          if (oauthConfig.discoverStatus != 'discovering') break;
          await delay(1000);
        }

        if (oauthConfig.discoverStatus == 'discovering') {
          deployingStep.log(`OAuth configuration discovery timed out.`);
          throw new Error('OAuth configuration discovery timed out');
        }

        if (oauthConfig.discoverStatus == 'failed') {
          deployingStep.log(`OAuth configuration discovery failed.`);
          deployingStep.log(`Error Code: ${oauthConfig.errorCode}`);
          deployingStep.log(`Message: ${oauthConfig.errorMessage}`);
        } else {
          deployingStep.log(`OAuth configuration discovered successfully.`);
          deployingStep.log('Provider details:');
          deployingStep.log(`Name: ${oauthConfig.providerName}`);
          deployingStep.log(`URL: ${oauthConfig.providerUrl}`);

          await db.server.updateMany({
            where: { oid: server.oid },
            data: { remoteOauthConfigOid: oauthConfig.oid }
          });

          await db.remoteOAuthConnection.updateMany({
            where: {
              serverOid: server.oid,
              status: { not: 'inactive' },
              discoveryStatus: { not: 'failed' }
            },
            data: { configOid: oauthConfig.oid }
          });

          let repointed = await db.remoteOAuthConnection.updateMany({
            where: {
              serverOid: server.oid,
              status: { not: 'inactive' },
              discoveryStatus: 'failed',
              registrationOid: null,
              secretOid: null,
              configOid: { not: oauthConfig.oid }
            },
            data: {
              configOid: oauthConfig.oid,
              registrationAttemptCount: 0,
              lastRegistrationAttemptAt: null
            }
          });

          if (repointed.count > 0) {
            deployingStep.log(
              `Retrying client registration for ${repointed.count} connection(s) that previously failed.`
            );
          }

          await retryFailedRegistrationsSearchQueue.add({ serverId: server.id });

          await rotateStaleCredentialsSearchQueue.add({ serverId: server.id });

          if (data.preflightOAuthRegistration) {
            if (!deployment.tenant) {
              throw new Error('OAuth registration preflight requires a tenant');
            }

            if (oauthConfig.discoverStatus == 'manual') {
              deployingStep.log(
                'OAuth provider does not advertise dynamic client registration. Manual client credentials will be required.'
              );
            } else {
              deployingStep.log('Validating OAuth dynamic client registration.');

              let credentials =
                await serverOAuthCredentialsService.ensureDefaultRemoteServerOAuthCredentials({
                  tenant: deployment.tenant,
                  server,
                  config: oauthConfig,
                  registrationMode: 'deferred'
                });
              let connection = credentials.remoteConnection;
              if (!connection) {
                throw new Error('Default OAuth credentials have no remote connection');
              }

              let registrationSucceeded = connection.discoveryStatus == 'succeeded';
              let lastFailureMessage = connection.errorMessage;

              for (let attempt = 1; attempt <= 3 && !registrationSucceeded; attempt++) {
                let registration = await remoteOAuthRegistrationService.runAutoRegistration({
                  connectionId: connection.id
                });

                if (
                  registration.ok ||
                  (registration.reason == 'skipped' &&
                    registration.blocker == 'already_succeeded')
                ) {
                  registrationSucceeded = true;
                  break;
                }

                if (registration.reason != 'failed') {
                  lastFailureMessage = `OAuth registration could not run: ${registration.reason}`;
                  break;
                }

                lastFailureMessage = registration.diagnostics.message;
                deployingStep.log(`OAuth registration attempt ${attempt} failed.`);
                if (registration.diagnostics.status !== null) {
                  deployingStep.log(`HTTP Status: ${registration.diagnostics.status}`);
                }
                if (registration.diagnostics.oauthCode) {
                  deployingStep.log(`OAuth Error: ${registration.diagnostics.oauthCode}`);
                }
                deployingStep.log(`Message: ${registration.diagnostics.message}`);
                if (registration.diagnostics.description) {
                  deployingStep.log(`Description: ${registration.diagnostics.description}`);
                }
                if (registration.diagnostics.contentType) {
                  deployingStep.log(
                    `Response Content-Type: ${registration.diagnostics.contentType}`
                  );
                }
                deployingStep.log(
                  `Provider Response${registration.diagnostics.responseTruncated ? ' (truncated to 16 KiB)' : ''}: ${registration.diagnostics.responseText}`
                );

                if (!registration.isTransient || attempt == 3) break;

                let retryDelay =
                  registration.diagnostics.retryAfterMs ?? (attempt == 1 ? 1000 : 2000);
                deployingStep.log(`Retrying OAuth registration in ${retryDelay}ms.`);
                await delay(retryDelay);
              }

              if (!registrationSucceeded) {
                throw new Error(
                  lastFailureMessage ?? 'OAuth dynamic client registration failed'
                );
              }

              deployingStep.log('OAuth dynamic client registration succeeded.');
            }
          }

          deployingStep.log(encode(oauthConfig.config));
        }
      } else {
        let manualAuth = await OAuthDiscovery.checkIfManualAuthIsNeeded(data.remoteUrl);

        if (manualAuth) {
          deployingStep.log(`Server requires manual authentication. OAuth is not supported.`);
          deployingStep.log(
            `Follow the provider's specification for settings the required headers or query parameters. You can pass them to Metorial using the headers and query fields when creating a provider config.`
          );
          remoteServerNeedsManualAuthentication = true;
        } else {
          deployingStep.log(`Server does not use OAuth authentication.`);
        }
      }

      let version = await db.serverVersion.create({
        data: {
          ...getId('serverVersion'),

          identifier: versionIdentifier.remote({
            server
          }),

          remoteUrl: data.remoteUrl,
          remoteProtocol: data.remoteProtocol,

          remoteServerNeedsManualAuthentication,

          configSchema: server.draftConfigSchema,
          configTransformer: server.draftConfigTransformer,

          serverOid: server.oid,
          tenantOid: server.tenantOid,
          deploymentOid: deployment.oid
        }
      });
      await serverVersionCreatedQueue.add({
        serverVersionId: version.id
      });

      deployingStep.log('MCP server deployment succeeded.');
      await deployingStep.succeed();

      await deployServerSucceededQueue.add({
        serverDeploymentId: data.serverDeploymentId
      });
    } catch (e) {
      deployingStep.log(`MCP server deployment failed.`);
      if (isServiceError(e)) {
        deployingStep.log(`Code: ${e.data.code}`);
        deployingStep.log(`Message: ${e.data.message}`);
      }

      await deployingStep.fail();

      await deployServerFailedQueue.add({
        serverDeploymentId: data.serverDeploymentId
      });
    }
  }
);
