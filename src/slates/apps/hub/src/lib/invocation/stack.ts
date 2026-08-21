import { delay } from '@lowerdeck/delay';
import { badRequestError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { getSentry } from '@lowerdeck/sentry';
import { serialize } from '@lowerdeck/serialize';
import type {
  SlatesParticipant,
  slatesRequestsByMethod,
  slatesResponsesByMethod
} from '@slates/proto';
import z from 'zod';
import type { SlateInvocation, SlateVersion } from '../../../prisma/generated/client';
import { db } from '../../db';
import {
  functionBay,
  functionBayTenant,
  getFunctionBayTenantForTenant
} from '../../functionBay';
import { hub } from '../../hub';
import { ID, snowflake } from '../../id';
import { invocationsBucketRecord } from '../../storage';
import { storeSlateInvocation } from './store';
import { runScopedRemoteInvocation, sanitizeScopedInvocationValue } from './types';
import type {
  InvocationError,
  InvocationResult,
  SlateInvocationBaseParams,
  SlateInvocationDeploymentTarget,
  SlatesScopedInvocationGrantEnvelope,
  SlatesRequest,
  SlatesResponse
} from './types';

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
  #invocationId: Promise<string>;
  #scopedSecurity?: SlateInvocationBaseParams['scopedSecurity'];
  #artifactSecurity?: SlateInvocationBaseParams['artifactSecurity'];
  #canonicalConfigSchema?: SlateInvocationBaseParams['canonicalConfigSchema'];
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
    this.#invocationId = d.invocationId
      ? Promise.resolve(d.invocationId)
      : ID.generateId('slateInvocation');
    this.#scopedSecurity = d.scopedSecurity;
    this.#artifactSecurity = d.artifactSecurity;
    this.#canonicalConfigSchema = d.canonicalConfigSchema;

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

      ...this.#initialMessages,
      ...this.#productiveMessages
    ];

    let invocationId = await this.#invocationId;
    let [runtimeTenant, deploymentTenant] = await Promise.all([
      this.#tenant ? getFunctionBayTenantForTenant(this.#tenant) : functionBayTenant,
      functionBayTenant
    ]);
    let [providerInvocation, invocationRecord] = await Promise.all([
      this.#scopedSecurity
        ? runScopedRemoteInvocation({
            hubInvocationId: invocationId,
            control: this.#scopedSecurity.executionControl,
            invoke: () =>
              functionBay.function.invoke({
                tenantId: runtimeTenant.id,
                functionTenantId: deploymentTenant.id,
                functionId: providerDeploymentInfo.functionId,
                payload: {
                  messages,
                  invocationId
                },
                enclave:
                  this.#enclaveId && runtimeTenant
                    ? { identifier: this.#enclaveId }
                    : undefined,
                egressPolicy: this.#egressPolicy
              })
          }).catch(error => ({
            id: '',
            logs: [],
            computeTimeMs: 0,
            billedTimeMs: 0,
            functionVersionId: '',
            type: 'error' as const,
            status: 'failed' as const,
            error: { code: 'scoped_invocation_terminated', message: String(error) },
            result: undefined
          }))
        : functionBay.function.invoke({
            tenantId: runtimeTenant.id,
            functionTenantId: deploymentTenant.id,
            functionId: providerDeploymentInfo.functionId,
            payload: {
              messages,
              invocationId
            },
            enclave:
              this.#enclaveId && runtimeTenant ? { identifier: this.#enclaveId } : undefined,
            egressPolicy: this.#egressPolicy
          }),
      db.slateInvocation.create({
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
      })
    ]);

    if (providerInvocation.type === 'error') {
      let sanitizedProviderInvocation = sanitizeScopedInvocationValue(
        providerInvocation,
        this.#scopedSecurity ?? this.#artifactSecurity
      );
      await storeSlateInvocation({
        slateVersion: this.#slateVersion,
        participants: this.#participants,
        record: invocationRecord,
        requestMessages: messages,
        invocationResult: sanitizedProviderInvocation,
        artifactSecurity: this.#scopedSecurity ?? this.#artifactSecurity,
        canonicalConfigSchema: this.#canonicalConfigSchema
      });

      return {
        status: 'error' as const,
        invocation: sanitizedProviderInvocation,

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
            message: `An error occurred during invocation: ${sanitizedProviderInvocation.error.message}`
          }
        })
      };
    }

    // If the result is encoded, decode it
    if (providerInvocation.result._encoded) {
      providerInvocation.result = serialize.decode(providerInvocation.result._encoded);
    }

    let resultMessages = providerInvocation.result.messages as SlatesResponse[];

    await storeSlateInvocation({
      slateVersion: this.#slateVersion,
      participants: this.#participants,
      record: invocationRecord,
      requestMessages: messages,
      responseMessages: resultMessages,
      invocationResult: providerInvocation,
      artifactSecurity: this.#scopedSecurity ?? this.#artifactSecurity,
      canonicalConfigSchema: this.#canonicalConfigSchema
    });

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
  }

  async invoke<Key extends keyof typeof slatesResponsesByMethod>(
    method: Key,
    params: z.infer<(typeof slatesRequestsByMethod)[Key]>['params'],
    invocation?: SlatesScopedInvocationGrantEnvelope
  ): Promise<InvocationResult<Key>> {
    if (this.#alreadyInvoked) {
      if (this.#scopedSecurity) {
        throw new Error('Scoped invocation stack cannot be restarted or rebound');
      }
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
        participants: this.#participants,
        enclaveId: this.#enclaveId,
        egressPolicy: this.#egressPolicy,
        initialMessages: this.#initialMessages
      }).invoke(method, params, invocation);
    }

    let requestId = invocation?.requestId ?? generatePlainId(10);
    this.#productiveMessages.push({
      jsonrpc: '2.0' as const,
      id: requestId,
      method,
      params,
      ...(invocation ? { invocation } : {})
    } as any);

    let run = await this.#runPromise;

    return run.mapMessage(method);
  }

  getInvocationId() {
    return this.#invocationId;
  }

  clearClassifiedInvocation() {
    this.#artifactSecurity = undefined;
  }
}
