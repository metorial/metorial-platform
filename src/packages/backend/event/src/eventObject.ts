import { getConfig } from '@metorial/config';
import { memo } from '@metorial/memo';
import { RedisStreams } from '@metorial/redis';
import { getSentry } from '@metorial/sentry';
import PQueue from 'p-queue';

let Sentry = getSentry();

export type Action<Name extends string, Input extends object> = {
  name: Name;
  payload: Input;
  getObject: (input: Input) => Input & { type: string };
};

export let eventObjectAction =
  <Input extends object>(opts: { type: string }) =>
  <Name extends string>(name: Name): Action<Name, Input> => ({
    name,
    payload: {} as Input,
    getObject: input => ({ ...input, type: opts.type })
  });

export interface EventPayload {
  action: string;
  payload: any;
}

export class EventObject<Actions extends { [key: string]: Action<string, any> } = {}> {
  #actions: Actions = {} as Actions;
  #fireQueue = new PQueue({ concurrency: Infinity });
  #getRedisStream: (name: string) => RedisStreams<EventPayload>;

  constructor(
    public readonly opts: {
      serviceName: string;
      objectName: string;
    }
  ) {
    this.#getRedisStream = memo((name: string) => {
      return new RedisStreams<EventPayload>(
        `${this.opts.serviceName}-${name}`,
        getConfig().redisUrl
      );
    });
  }

  action<Name extends string, Payload extends object>(action: Action<Name, Payload>) {
    // @ts-ignore
    this.#actions[action.name] = action;

    return this as any as EventObject<Actions & { [K in Name]: Action<Name, Payload> }>;
  }

  task<Name extends keyof Actions>(
    opts: {
      actionNames: [Name, ...Name[]];
      taskName: string;
      objectNameOverride?: string;
    },
    cb: (ctx: {
      payload: Actions[Name]['payload'] & { type: string };
      action: Name;
    }) => Promise<any>
  ) {
    let actionSet = new Set(opts.actionNames as string[]);

    return {
      start: () =>
        this.#getRedisStream(opts.objectNameOverride ?? this.opts.objectName).createReceiver(
          { groupId: opts.taskName, concurrency: 20 },
          async data => {
            if (!actionSet.has(data.action)) return;

            await cb({ payload: data.payload, action: data.action as Name });
          }
        )
    };
  }

  fire<Name extends keyof Actions & string>(
    name: Name,
    input: Actions[Name]['payload'],
    opts?: { objectNameOverride?: string }
  ) {
    this.#fireQueue.add(async () => {
      let sender = this.#getRedisStream(opts?.objectNameOverride ?? this.opts.objectName);
      let output = this.#actions[name].getObject(input);

      try {
        await sender.send({
          action: name,
          payload: output
        });
      } catch (e) {
        Sentry.captureException(e);
        console.error(e);
      }
    });
  }
}
