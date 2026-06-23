import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Server, ServerRemoteProtocol, Tenant } from '../../prisma/generated/client';
import { getId } from '../id';
import { oauthConfigValidator, type OAuthConfiguration } from '../lib/oauth/types';
import { deployContainerServerStartQueue } from '../queues/container/startDeployment';
import { deployFunctionServerStartQueue } from '../queues/function/startDeployment';
import { deployRemoteServerStartQueue } from '../queues/remote/startDeployment';
import { addAfterTransactionHook, withTransaction } from '../transaction';
import { secretService } from './secret';
import { serverDeploymentInclude } from './serverDeployment';

class serverDeploymentCreateServiceImpl {
  async deployFunctionServer(d: {
    scope: { type: 'global' } | { type: 'tenant'; tenant: Tenant };

    server: Server;

    input: {
      files: {
        filename: string;
        content: string;
        encoding?: 'utf-8' | 'base64';
      }[];
      env: Record<string, string>;
      runtime:
        | { identifier: 'nodejs'; version: '24.x' | '22.x' }
        | { identifier: 'python'; version: '3.14' | '3.13' | '3.12' };
    };
  }) {
    return await withTransaction(async db => {
      let upcomingFunctionServer = await db.upcomingFunctionServer.create({
        data: {
          ...getId('upcomingFunctionServer'),
          serverOid: d.server.oid,
          tenantOid: d.server.tenantOid,

          payload: {
            files: d.input.files,
            env: d.input.env,
            runtime: d.input.runtime
          }
        }
      });

      let deployment = await db.serverDeployment.create({
        data: {
          ...getId('serverDeployment'),
          serverOid: d.server.oid,
          tenantOid: d.server.tenantOid,
          status: 'queued'
        },
        include: serverDeploymentInclude
      });

      await addAfterTransactionHook(() =>
        deployFunctionServerStartQueue.add({
          upcomingFunctionServerId: upcomingFunctionServer.id,
          serverDeploymentId: deployment.id
        })
      );

      return deployment;
    });
  }

  async deployContainerServer(d: {
    scope: { type: 'global' } | { type: 'tenant'; tenant: Tenant };

    server: Server;

    input: {
      imageRef: string;
      username?: string;
      password?: string;
    };
  }) {
    return await withTransaction(async db => {
      let secret =
        d.input.username && d.input.password && d.scope.type == 'tenant'
          ? await secretService.createSecret({
              tenant: d.scope.tenant,
              purpose: 'registry_credentials',
              secretData: {
                registryUrl: d.input.imageRef,
                username: d.input.username,
                password: d.input.password
              }
            })
          : undefined;

      let deployment = await db.serverDeployment.create({
        data: {
          ...getId('serverDeployment'),
          serverOid: d.server.oid,
          tenantOid: d.server.tenantOid,
          status: 'queued'
        },
        include: serverDeploymentInclude
      });

      await addAfterTransactionHook(() =>
        deployContainerServerStartQueue.add({
          serverDeploymentId: deployment.id,
          from: {
            type: 'image_ref',
            imageRef: d.input.imageRef,
            secretId: secret?.id
          }
        })
      );

      return deployment;
    });
  }

  async deployRemoteServer(d: {
    scope: { type: 'global' } | { type: 'tenant'; tenant: Tenant };

    server: Server;

    input: {
      remoteUrl: string;
      protocol: ServerRemoteProtocol;
      oauthConfig?: Record<string, any>;
    };
  }) {
    let url: URL;
    try {
      url = new URL(d.input.remoteUrl);
    } catch (e) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid remote URL provided.',
          code: 'remote_invalid',
          reason: 'remote_invalid.invalid_url'
        })
      );
    }

    let oauthConfig: OAuthConfiguration | undefined = undefined;

    if (d.input.oauthConfig) {
      let valRes = oauthConfigValidator.validate(d.input.oauthConfig);
      if (!valRes.success) {
        throw new ServiceError(
          badRequestError({
            message: `Invalid OAuth configuration from ${d.input.remoteUrl}`,
            details: valRes.errors,
            code: 'remote_invalid',
            reason: 'remote_invalid.invalid_oauth_config'
          })
        );
      }

      oauthConfig = d.input.oauthConfig as OAuthConfiguration;
    }

    return withTransaction(async db => {
      let deployment = await db.serverDeployment.create({
        data: {
          ...getId('serverDeployment'),
          serverOid: d.server.oid,
          tenantOid: d.server.tenantOid,
          status: 'queued'
        },
        include: serverDeploymentInclude
      });

      await addAfterTransactionHook(() =>
        deployRemoteServerStartQueue.add({
          serverDeploymentId: deployment.id,
          remoteUrl: d.input.remoteUrl,
          remoteProtocol: d.input.protocol,
          oauthConfig
        })
      );

      return deployment;
    });
  }
}

export let serverDeploymentCreateService = Service.create(
  'serverDeploymentCreateService',
  () => new serverDeploymentCreateServiceImpl()
).build();
