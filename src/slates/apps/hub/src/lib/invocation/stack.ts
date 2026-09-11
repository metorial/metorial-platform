import { delay } from '@lowerdeck/delay';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { getSentry } from '@lowerdeck/sentry';
import { serialize } from '@lowerdeck/serialize';
import type { FunctionInvokeResponse } from '@metorial-platform-systems/function-bay-client';
import type {
  SlatesParticipant,
  slatesRequestsByMethod,
  slatesResponsesByMethod
} from '@slates/proto';
import z from 'zod';
import type { SlateInvocation, SlateVersion } from '../../../prisma/generated/client';
import { db } from '../../db';
import { env } from '../../env';
import {
  functionBay,
  functionBayTenant,
  getFunctionBayTenantForTenant
} from '../../functionBay';
import { hub } from '../../hub';
import { ID, snowflake } from '../../id';
import { invocationsBucketRecord } from '../../storage';
import { mintLiveInvocationToken } from './liveToken';
import { isJsonRpcServerError, reportSlateInvocationServerError } from './report';
import { storeSlateInvocation } from './store';
import type {
  InvocationError,
  InvocationResult,
  SlateInvocationBaseParams,
  SlateInvocationDeploymentTarget,
  SlatesRequest,
  SlatesResponse
} from './types';

let DEFAULT_MAX_ATTACHMENT_SIZE_BYTES = 100 * 1024 * 1024;

let Sentry = getSentry();

let errorSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.string().optional().nullable(),
  error: z.record(z.string(), z.any())
});

export class SlateInvocationStack {
  #initialMessages: SlatesRequest[];
  #slateVersion: SlateVersion;
  #deploymentTarget?: SlateInvocationDeploymentTarget;
  #participants: SlatesParticipant[];
  #tenant?: SlateInvocationBaseParams['tenant'];
  #enclaveId?: string;
  #egressPolicy?: PrismaJson.CompiledEgressNetworkAllowList;
  #suppressServerErrorReporting: boolean;
  #capabilities?: PrismaJson.SlateCapabilities;
  #productiveMessages: SlatesRequest[] = [];
  #alreadyInvoked = false;
  #runPromise: ReturnType<typeof this.run>;

  constructor(d: SlateInvocationBaseParams & { initialMessages?: SlatesRequest[] }) {
    this.#initialMessages = d.initialMessages ?? [];
    this.#slateVersion = d.slateVersion;
    this.#deploymentTarget = d.deploymentTarget;
    this.#participants = d.participants;
    this.#tenant = d.tenant;
    this.#enclaveId = d.enclaveId;
    this.#egressPolicy = d.egressPolicy;
    this.#suppressServerErrorReporting = d.suppressServerErrorReporting ?? false;
    this.#capabilities = d.capabilities ?? d.slateVersion.capabilities;

    this.#runPromise = this.run();
  }

  private async run() {
    let providerDeploymentInfo =
      this.#deploymentTarget?.providerDeploymentInfo ??
      this.#slateVersion.providerDeploymentInfo;
    let activeDeploymentOid =
      this.#deploymentTarget?.activeDeploymentOid ?? this.#slateVersion.activeDeploymentOid;

    if (!providerDeploymentInfo || !activeDeploymentOid) {
      throw new ServiceError(badRequestError({ message: 'Slate version is not deployed' }));
    }

    await delay(2);

    this.#alreadyInvoked = true;

    let invocationId = await ID.generateId('slateInvocation');

    let capabilities = this.#capabilities?.hub;
    let supportsHubCapabilities = !!capabilities?.capabilitiesNotification;
    let supportsLiveInvocation = !!capabilities?.liveInvocation;

    let liveInvocationToken =
      this.#tenant && supportsLiveInvocation
        ? await mintLiveInvocationToken({ invocationId, tenantOid: this.#tenant.oid })
        : null;

    let messages: SlatesRequest[] = [
      { jsonrpc: '2.0', method: 'slates/hello', params: { protocol: 'slates@2026-01-01' } },
      {
        jsonrpc: '2.0',
        method: 'slates/participant.set',
        params: {
          participants: [
            ...this.#participants,
            { type: 'hub', id: hub.identifier, name: 'Hub' }
          ]
        }
      },
      ...(supportsHubCapabilities
        ? [
            {
              jsonrpc: '2.0' as const,
              method: 'slates/hub.capabilities.set' as const,
              params: {
                capabilities: {
                  attachments: {
                    directUpload: {
                      enabled: true,
                      maxAttachmentSizeBytes:
                        env.storage.MAX_ATTACHMENT_SIZE_BYTES ??
                        DEFAULT_MAX_ATTACHMENT_SIZE_BYTES
                    }
                  },
                  triggers: true
                }
              }
            }
          ]
        : []),
      ...(liveInvocationToken
        ? [
            {
              jsonrpc: '2.0' as const,
              method: 'slates/hub.live_invocation.set' as const,
              params: {
                token: liveInvocationToken.token,
                baseUrl: env.service.SERVICE_PUBLIC_URL
              }
            }
          ]
        : []),

      ...this.#initialMessages,
      ...this.#productiveMessages
    ];

    let invocationRecord = await db.slateInvocation.create({
      data: {
        oid: snowflake.nextId(),
        id: invocationId,
        deploymentOid: activeDeploymentOid,
        bucketOid: invocationsBucketRecord.oid,
        isPending: true,
        providerInvocationId: '',
        hasInvocationError: false,
        hasResponseError: false
      }
    });

    try {
      let [runtimeTenant, deploymentTenant] = await Promise.all([
        this.#tenant ? getFunctionBayTenantForTenant(this.#tenant) : functionBayTenant,
        functionBayTenant
      ]);
      let providerInvocation = await functionBay.function.invoke({
        tenantId: runtimeTenant.id,
        functionTenantId: deploymentTenant.id,
        functionId: providerDeploymentInfo.functionId,
        payload: { messages, invocationId },
        enclave:
          this.#enclaveId && runtimeTenant ? { identifier: this.#enclaveId } : undefined,
        egressPolicy: this.#egressPolicy
      });

      liveInvocationToken?.release().catch(e => Sentry.captureException(e));

      if (providerInvocation.type === 'error') {
        reportSlateInvocationServerError({
          reason: 'function_bay_error',
          invocationId,
          invocationOid: invocationRecord.oid,
          slateVersionId: this.#slateVersion.id,
          tenantIdentifier: this.#tenant?.identifier,
          providerInvocationId: providerInvocation.id,
          error: providerInvocation.error,
          logs: providerInvocation.logs,
          methods: messages.map(m => m.method),
          suppressSentry: this.#suppressServerErrorReporting
        });

        await storeSlateInvocation({
          tenant: this.#tenant,
          slateVersion: this.#slateVersion,
          participants: this.#participants,
          record: invocationRecord,
          requestMessages: messages,
          invocationResult: providerInvocation
        });

        return {
          status: 'error' as const,
          invocation: providerInvocation,

          mapMessage: <Key extends keyof typeof slatesResponsesByMethod>(
            _: Key
          ): {
            status: 'error';
            invocation: SlateInvocation;
            error: InvocationError;
          } => ({
            status: 'error',
            invocation: invocationRecord,
            error: {
              code: 'invocation_error',
              message: `An error occurred during invocation: ${providerInvocation.error.message}`
            }
          })
        };
      }

      // If the result is encoded, decode it
      if (providerInvocation.result._encoded) {
        providerInvocation.result = serialize.decode(providerInvocation.result._encoded);
      }

      let resultMessages = providerInvocation.result.messages as SlatesResponse[];

      let jsonRpcServerErrors = (resultMessages ?? []).flatMap(m => {
        if (!m || typeof m !== 'object' || !('error' in m) || !m.error) return [];
        return isJsonRpcServerError(m.error) ? [m.error] : [];
      });

      if (jsonRpcServerErrors.length > 0) {
        reportSlateInvocationServerError({
          reason: 'jsonrpc_server_error',
          invocationId,
          invocationOid: invocationRecord.oid,
          slateVersionId: this.#slateVersion.id,
          tenantIdentifier: this.#tenant?.identifier,
          providerInvocationId: providerInvocation.id,
          error: jsonRpcServerErrors,
          logs: providerInvocation.logs,
          methods: messages.map(m => m.method),
          suppressSentry: this.#suppressServerErrorReporting
        });
      }

      let storePromise = storeSlateInvocation({
        tenant: this.#tenant,
        slateVersion: this.#slateVersion,
        participants: this.#participants,
        record: invocationRecord,
        requestMessages: messages,
        responseMessages: resultMessages,
        invocationResult: providerInvocation
      });
      if (jsonRpcServerErrors.length > 0) await storePromise;

      return {
        status: 'success' as const,

        invocation: invocationRecord,
        messages: resultMessages,

        mapMessage: <Key extends keyof typeof slatesResponsesByMethod>(
          key: Key
        ):
          | {
              status: 'success';
              invocation: SlateInvocation;
              data: z.infer<(typeof slatesResponsesByMethod)[Key]>['result'];
            }
          | {
              status: 'error';
              invocation: SlateInvocation;
              error: InvocationError;
            } => {
          let inputMessage = messages.find(m => m.method === key);
          if (!inputMessage || !('id' in inputMessage) || !inputMessage.id) {
            return {
              status: 'error',
              invocation: invocationRecord,
              error: {
                code: 'no_input_message',
                message: `No input message found for method ${key}`
              }
            };
          }

          let outputMessage: any = resultMessages.find(
            m => 'id' in m && m.id === inputMessage.id
          );
          if (!outputMessage || typeof outputMessage !== 'object' || outputMessage === null) {
            let errorMessage = resultMessages.find(m => 'error' in m);
            if (errorMessage) {
              let parse = errorSchema.safeParse(errorMessage);
              if (!parse.success) {
                return {
                  status: 'error',
                  invocation: invocationRecord,
                  error: {
                    code: 'invalid_error_message',
                    message: `Output error message for method ${key} is invalid: ${parse.error.message}`
                  }
                };
              }

              return {
                status: 'error',
                invocation: invocationRecord,
                error: {
                  ...parse.data.error,
                  code: parse.data.error.code || 'unknown_error'
                } as any
              };
            }

            return {
              status: 'error',
              invocation: invocationRecord,
              error: {
                code: 'no_output_message',
                message: `Provider did not return a message for method ${key}`
              }
            };
          }

          if ('error' in outputMessage && outputMessage.error) {
            let parse = errorSchema.safeParse(outputMessage);
            if (!parse.success) {
              return {
                status: 'error',
                invocation: invocationRecord,
                error: {
                  code: 'invalid_error_message',
                  message: `Output error message for method ${key} is invalid: ${parse.error.message}`
                }
              };
            }

            return {
              status: 'error',
              invocation: invocationRecord,
              error: outputMessage.error
            };
          }

          if (!('result' in outputMessage)) {
            return {
              status: 'error',
              invocation: invocationRecord,
              error: {
                code: 'no_result',
                message: `Output message for method ${key} has no result`
              }
            };
          }

          // let valRes = slatesResponsesByMethod[key].safeParse(outputMessage);
          // if (!valRes.success) {
          //   throw new ServiceError(
          //     badRequestError({
          //       message: `Output message for method ${key} is invalid: ${valRes.error.message}`
          //     })
          //   );
          // }

          return {
            status: 'success',
            invocation: invocationRecord,
            data: outputMessage.result
          };
        }
      };
    } catch (err) {
      liveInvocationToken?.release().catch(e => Sentry.captureException(e));

      reportSlateInvocationServerError({
        reason: 'invocation_exception',
        invocationId,
        invocationOid: invocationRecord.oid,
        slateVersionId: this.#slateVersion.id,
        tenantIdentifier: this.#tenant?.identifier,
        error: err,
        methods: messages.map(m => m.method),
        suppressSentry: this.#suppressServerErrorReporting
      });

      await storeSlateInvocation({
        tenant: this.#tenant,
        slateVersion: this.#slateVersion,
        participants: this.#participants,
        record: invocationRecord,
        requestMessages: messages,
        invocationResult: {
          type: 'error',
          error: {
            code: 'invocation_exception',
            message: 'Internal server error'
          }
        } as FunctionInvokeResponse
      });

      throw err;
    }
  }

  async invoke<Key extends keyof typeof slatesResponsesByMethod>(
    method: Key,
    params: z.infer<(typeof slatesRequestsByMethod)[Key]>['params']
  ): Promise<InvocationResult<Key>> {
    if (this.#alreadyInvoked) {
      Sentry.captureMessage(
        'SlateInvocationStack was already invoked but still received a new message',
        {
          level: 'warning',
          extra: {
            method,
            slateVersionId: this.#slateVersion.id
          }
        }
      );

      return new SlateInvocationStack({
        tenant: this.#tenant,
        slateVersion: this.#slateVersion,
        deploymentTarget: this.#deploymentTarget,
        participants: this.#participants,
        enclaveId: this.#enclaveId,
        egressPolicy: this.#egressPolicy,
        suppressServerErrorReporting: this.#suppressServerErrorReporting,
        capabilities: this.#capabilities,
        initialMessages: this.#initialMessages
      }).invoke(method, params);
    }

    this.#productiveMessages.push({
      jsonrpc: '2.0' as const,
      id: generatePlainId(10),
      method,
      params
    } as any);

    let run = await this.#runPromise;

    return run.mapMessage(method);
  }
}
