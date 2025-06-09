import { debug } from '@metorial/debug';
import { MICEndpoint } from '@metorial/interconnect';
import { MICTransceiverWebsocketClient } from '@metorial/interconnect-websocket-client';
import { v } from '@metorial/validation';
import { ReconnectingWebSocketClient } from '@metorial/websocket';
import { DockerManagerOptions } from '../lib/docker/dockerManager';
import { getLaunchParams } from '../lib/launchParams';
import { getMcpSessionManager } from '../lib/session/manager';
import { SessionTokens } from '../lib/tokens';
import { getServer, RunnerServerRef } from '../server';
import { VERSION } from '../version';

export let startConnection = async (d: {
  host: string;
  connectionKey: string;
  tags: string[];
  maxConcurrentJobs: number;
  dockerOpts: DockerManagerOptions;

  server: {
    port: number;
    url: string;
  };
}) => {
  let url = new URL('/mcp/sse', d.server.url);

  let McpSessionManager = getMcpSessionManager();

  let metorialUrl = `${d.host.includes(':') ? 'ws' : 'wss'}://${d.host}/metorial_runner_interconnect?metorial_runner_connection_key=${d.connectionKey}`;

  let transceiver = new MICTransceiverWebsocketClient(
    {
      sessionId: 'runner',
      connectionId: 'metorial-server'
    },
    new ReconnectingWebSocketClient(metorialUrl, {
      onReconnect: () => console.log('Reconnecting to Metorial...')
    })
  );

  transceiver.onClose(() => {
    console.log('Runner closed');
    process.exit(0);
  });

  let serverRef: RunnerServerRef = {};
  Bun.serve({
    port: d.server.port,
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

        session.onClose(d => {
          ctx.notify('run/closed', {
            serverRunId: data.serverRunId,
            result: d
          });
        });

        session.onLogs(d => {
          ctx.notify('run/logs', {
            serverRunId: data.serverRunId,
            lines: d.lines,
            time: d.time
          });
        });

        await session.waitForStart;

        let token = await SessionTokens.sign({
          sessionId: info.id
        });

        return {
          token,
          url: url.toString()
        };
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
    .connect(transceiver);
};
