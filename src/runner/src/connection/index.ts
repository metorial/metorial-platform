import { debug } from '@metorial/debug';
import { MICEndpoint } from '@metorial/interconnect';
import { MICTransceiverWebsocketClient } from '@metorial/interconnect-websocket-client';
import { v } from '@metorial/validation';
import { ReconnectingWebSocketClient } from '@metorial/websocket';
import { DockerManagerOptions } from '../lib/docker/dockerManager';
import { getLaunchParams } from '../lib/launchParams';
import { McpSessionManager } from '../lib/session/manager';
import { SessionTokens } from '../lib/tokens';
import { getServer, RunnerServerRef } from '../server';
import { VERSION } from '../version';

export let startConnection = async (d: {
  host: string;
  connectionKey: string;
  tags: string[];
  maxConcurrentJobs: number;
  dockerOpts: DockerManagerOptions;
  url: string;
}) => {
  let url = new URL('/mcp/sse', d.url);

  let transceiver = new MICTransceiverWebsocketClient(
    {
      sessionId: 'runner',
      connectionId: 'metorial-server'
    },
    new ReconnectingWebSocketClient(
      `ws://${d.host}/metorial_runner_interconnect?metorial_runner_connection_key=${d.connectionKey}`,
      { onReconnect: () => console.log('Reconnecting to Metorial...') }
    )
  );

  transceiver.onMessage(m => console.log('Incoming message', m));

  transceiver.onClose(() => {
    console.log('Runner closed');
    process.exit(0);
  });

  let serverRef: RunnerServerRef = {};
  Bun.serve({
    port: url.port,
    fetch: getServer(url.origin, serverRef).fetch,
    idleTimeout: 0
  });

  new MICEndpoint()
    .notification(
      'server/initialize',
      v.object({
        id: v.string(),
        identifier: v.string(),
        name: v.string()
      }),
      async (data, ctx) => {
        console.log('Runner connected to Metorial');
        console.log('  - Runner ID: ', data.id);
        console.log('  - Runner Identifier: ', data.identifier);
        console.log('  - Runner Name: ', data.name);

        let config = {
          attributes: ['supports_docker_images'],
          tags: d.tags,
          maxConcurrentJobs: d.maxConcurrentJobs,
          version: VERSION
        };

        await ctx.request('server/set_config', config);

        console.log('Runner config set');
        console.log('  - Tags: ', config.tags);
        console.log('  - Attributes: ', config.attributes);
        console.log('  - Max Concurrent Jobs: ', config.maxConcurrentJobs);
        console.log('  - Version: ', config.version);

        await ctx.notify('server/ready', {});

        console.log('Runner is ready to accept jobs');

        serverRef.mic = ctx;
      }
    )
    .request(
      'run/start',
      v.object({
        serverRunId: v.string(),

        source: v.object({
          type: v.literal('docker'),
          image: v.string(),
          tag: v.nullable(v.string())
        }),

        launchParams: v.object({
          command: v.string(),
          args: v.optional(v.array(v.string())),
          env: v.optional(v.record(v.string()))
        })
      }),
      async (data, ctx) => {
        debug.log('Starting server run', data.serverRunId);

        let { session, info } = McpSessionManager.createSession({
          containerOpts: {
            image: data.source.image,
            tag: data.source.tag ?? undefined,
            command: data.launchParams!.command,
            args: data.launchParams!.args ?? [],
            env: data.launchParams!.env ?? {}
          },
          dockerOpts: d.dockerOpts
        });

        await session.waitForStart;

        session.onClose(() => {
          ctx.notify('run/closed', {
            serverRunId: data.serverRunId
          });
        });

        let token = await SessionTokens.sign({
          sessionId: info.id
        });

        return {
          token,
          url: url.toString()
        };

        // session.onOutgoingMessage(msg => {
        //   ctx.notify('run/mcp/message', {
        //     serverRunId: data.serverRunId,
        //     message: msg
        //   });
        // });

        // session.onDebugMessage(output => {
        //   ctx.notify('run/mcp/debug', {
        //     serverRunId: data.serverRunId,
        //     type: output.type,
        //     payload: output.payload
        //   });
        // });
      }
    )
    .request(
      'get_launch_params',
      v.object({
        getLaunchParams: v.string(),
        config: v.record(v.any())
      }),
      async (data, ctx) => {
        return await getLaunchParams({
          getLaunchParams: data.getLaunchParams,
          config: data.config
        });
      }
    )
    // .notification(
    //   'run/close',
    //   v.object({
    //     serverRunId: v.string()
    //   }),
    //   async data => {
    //     debug.log('Closing session', data);

    //     let session = McpSession.get(data.serverRunId);
    //     if (session) await session.close();
    //   }
    // )
    // .notification(
    //   'run/mcp/message',
    //   v.object({
    //     serverRunId: v.string(),
    //     message: v.any()
    //   }),
    //   async data => {
    //     debug.log('Incoming message', data);

    //     let session = McpSession.get(data.serverRunId);
    //     if (session) {
    //       await session.incomingMessage(
    //         Array.isArray(data.message) ? data.message : [data.message]
    //       );
    //     }
    //   }
    // )
    .connect(transceiver);
};
