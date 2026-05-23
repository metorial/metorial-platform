import { delay } from '@mtsrc/delay';
import { badRequestError, ServiceError } from '@mtsrc/error';
import { generatePlainId } from '@mtsrc/id';
import { getSentry } from '@mtsrc/sentry';
import { serialize } from '@mtsrc/serialize';
import type {
  SlatesParticipant,
  slatesRequestsByMethod,
  slatesResponsesByMethod
} from '@slates/proto';
import z from 'zod';
import type { SlateInvocation, SlateVersion } from '../../../prisma/generated/client';
import { db } from '../../db';
import { functionBay, functionBayTenant } from '../../functionBay';
import { hub } from '../../hub';
import { ID, snowflake } from '../../id';
import { invocationsBucketRecord } from '../../storage';
import { storeSlateInvocation } from './store';
import type {
  InvocationError,
  InvocationResult,
  SlateInvocationBaseParams,
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
  #participants: SlatesParticipant[];
  #productiveMessages: SlatesRequest[] = [];
  #alreadyInvoked = false;
  #runPromise: ReturnType<typeof this.run>;

  constructor(d: SlateInvocationBaseParams & { initialMessages?: SlatesRequest[] }) {
    this.#initialMessages = d.initialMessages ?? [];
    this.#slateVersion = d.slateVersion;
    this.#participants = d.participants;

    this.#runPromise = this.run();
  }

  private async run() {
    if (
      !this.#slateVersion.providerDeploymentInfo ||
      !this.#slateVersion.activeDeploymentOid
    ) {
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

    let invocationId = await ID.generateId('slateInvocation');
    let [providerInvocation, invocationRecord] = await Promise.all([
      functionBay.function.invoke({
        tenantId: (await functionBayTenant).id,
        functionId: this.#slateVersion.providerDeploymentInfo.functionId,
        payload: { messages, invocationId }
      }),
      db.slateInvocation.create({
        data: {
          oid: snowflake.nextId(),
          id: invocationId,
          deploymentOid: this.#slateVersion.activeDeploymentOid,
          bucketOid: invocationsBucketRecord.oid,
          isPending: true,
          providerInvocationId: '',
          hasInvocationError: false,
          hasResponseError: false
        }
      })
    ]);

    if (providerInvocation.type === 'error') {
      storeSlateInvocation({
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

    storeSlateInvocation({
      slateVersion: this.#slateVersion,
      participants: this.#participants,
      record: invocationRecord,
      requestMessages: messages,
      responseMessages: resultMessages,
      invocationResult: providerInvocation
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
        slateVersion: this.#slateVersion,
        participants: this.#participants,
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
