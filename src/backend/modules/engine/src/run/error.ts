import { db, ID, Instance, ServerDeployment, ServerRun } from '@metorial/db';
import { Hash } from '@metorial/hash';
import { EngineSessionError, McpError_McpErrorCode } from '@metorial/mcp-engine-generated';

let errorCodeToString = (code: string) => {
  switch (code) {
    case 'failed_to_start':
      return 'server_failed_to_start';
    case 'failed_to_stop':
      return 'server_failed_to_stop';
    case 'launch_params_error':
      return 'get_launch_params_error';
    case 'execution_error':
      return 'server_exited_error';
  }

  return code;
};

export let createServerError = async (d: {
  deployment: ServerDeployment;
  error: EngineSessionError;
  instance: Instance;
  serverRun: ServerRun;
}) => {
  let errorFingerprint = await Hash.sha256(
    JSON.stringify([d.error.errorCode, String(d.deployment.serverImplementationOid)])
  );

  let message =
    {
      [McpError_McpErrorCode.failed_to_start]: 'Server failed to start',
      [McpError_McpErrorCode.failed_to_stop]: 'Server failed to stop',
      [McpError_McpErrorCode.invalid_mcp_message]: 'Invalid MCP message',
      [McpError_McpErrorCode.unknown_error]: 'Unknown error',
      [McpError_McpErrorCode.timeout]: 'Server timeout',
      [McpError_McpErrorCode.launch_params_error]: 'Get launch params function failed',
      [McpError_McpErrorCode.execution_error]: 'Server exited with error',

      [McpError_McpErrorCode.UNRECOGNIZED]: 'Unknown error'
    }[d.error.errorCode] ?? 'Unknown error';

  let group = await db.serverRunErrorGroup.findUnique({
    where: {
      fingerprint_serverOid_instanceOid: {
        fingerprint: errorFingerprint,
        serverOid: d.deployment.serverOid,
        instanceOid: d.instance.oid
      }
    }
  });

  if (!group) {
    group = await db.serverRunErrorGroup.upsert({
      where: {
        fingerprint_serverOid_instanceOid: {
          fingerprint: errorFingerprint,
          serverOid: d.deployment.serverOid,
          instanceOid: d.instance.oid
        }
      },
      create: {
        id: await ID.generateId('serverRunErrorGroup'),
        fingerprint: errorFingerprint,
        message,
        code: errorCodeToString(d.error.errorCode),
        count: 1,
        serverOid: d.deployment.serverOid,
        instanceOid: d.instance.oid,
        lastSeenAt: new Date()
      },
      update: {
        count: { increment: 1 },
        lastSeenAt: new Date()
      }
    });
  }

  let error = await db.serverRunError.create({
    data: {
      id: ID.normalizeUUID('serverRunError', d.error.id),
      code: group.code,
      message,
      metadata: {},
      serverDeploymentOid: d.deployment.oid,
      serverRunErrorGroupOid: group.oid,
      serverRunOid: d.serverRun.oid,
      instanceOid: d.instance.oid
    }
  });

  // Attach this as the default error for this group,
  // if it doesn't have one already
  if (group.defaultServerRunErrorOid === null) {
    await db.serverRunErrorGroup.updateMany({
      where: { oid: group.oid },
      data: { defaultServerRunErrorOid: error.oid }
    });
  }

  return error;

  // await db.sessionEvent.createMany({
  //   data: {
  //     id: await ID.generateId('sessionEvent'),
  //     type: 'server_run_error',
  //     sessionOid: d.session.sessionOid,
  //     serverRunOid: d.serverRun.oid,
  //     serverRunErrorOid: error.oid,
  //     payload: {
  //       code: d.result.reason,
  //       exitCode: d.result.exitCode ?? 0
  //     }
  //   }
  // });
};
