import { ServiceError, unauthorizedError } from '@metorial/error';
import { createHono } from '@metorial/hono';
import { MICEndpoint, MICSessionManger } from '@metorial/interconnect';
import { MICTransceiverWebsocketServer } from '@metorial/interconnect-websocket-server';
import { v } from '@metorial/validation';
import type { ServerWebSocket } from 'bun';
import type { UpgradeWebSocket, WSEvents } from 'hono/ws';
import { RunnerBrokerManager } from '../broker/implementations/hosted';
import { BrokerRunManager } from '../broker/manager';
import { RunJobProcessorUtils } from '../broker/runJobProcessorUtils';
import { serverRunnerConnectionService } from '../services';
import { createRunnerQueueProcessor } from './runnerQueue';

let MAX_PING_INTERVAL = 10 * 1000;
let SEND_PING_INTERVAL = 7 * 1000;
let PING_SAVE_INTERVAL = 60 * 1000;

export let createServerRunnerGateway = (
  upgradeWebSocket: UpgradeWebSocket<ServerWebSocket, any, WSEvents<ServerWebSocket>>
) => {
  return createHono().get(
    '/metorial_runner_interconnect',
    upgradeWebSocket(async c => {
      let connectionKey = c.req.query('metorial_runner_connection_key');
      if (!connectionKey)
        throw new ServiceError(unauthorizedError({ message: 'Missing connection key' }));

      let runner = await serverRunnerConnectionService.registerServerRunner({
        connectionKey
      });

      // Connection management
      let transceiver: MICTransceiverWebsocketServer | undefined = undefined;
      let session: MICSessionManger | undefined = undefined;
      let pingInterval: NodeJS.Timer | undefined = undefined;
      let lastPing = Date.now();
      let lastPingSaved = Date.now();

      // Runner management
      let closeQueue: (() => void) | undefined = undefined;
      let runnerManager: RunnerBrokerManager | undefined = undefined;

      let endpoint = new MICEndpoint()
        .request(
          'server/set_config',
          v.object({
            attributes: v.array(v.enumOf(['supports_docker_images'])),
            tags: v.array(v.string()),
            maxConcurrentJobs: v.number(),
            version: v.enumOf(['v1.0.0'])
          }),
          async config => {
            await serverRunnerConnectionService.setServerRunnerConfig({
              runner,
              input: config
            });
          }
        )
        .notification('server/ready', v.any(), async () => {
          runnerManager = new RunnerBrokerManager(session!);

          closeQueue = await createRunnerQueueProcessor(runner, {
            start_session_run: async ({ serverSessionId }) => {
              let info = await RunJobProcessorUtils.createServerRun({
                serverSessionId,
                runner
              });
              if (!info) return;

              if (!info.variant.currentVersion || !info.variant.currentVersion.dockerImage) {
                console.error('No current version for variant', info.variant);
                return;
              }

              let launchParams = await session!.request<
                { type: 'error'; output: string } | { type: 'success'; output: any }
              >('get_launch_params', {
                config: info.DANGEROUSLY_UNENCRYPTED_CONFIG,
                getLaunchParams:
                  info.implementation.getLaunchParams ?? info.version.getLaunchParams
              });

              console.log('Launch params', launchParams);

              if (launchParams.type == 'error') {
                // TODO: run failed
              } else {
                let manager = new BrokerRunManager(
                  runnerManager!.create(info.serverRun),
                  info.serverRun,
                  info.session
                );

                console.log({
                  serverRunId: info.serverRun.id,
                  source: {
                    type: 'docker',
                    image: info.variant.currentVersion.dockerImage,
                    tag: info.variant.currentVersion.dockerTag
                  },
                  launchParams: launchParams.output
                });

                await session!.request('run/execute', {
                  serverRunId: info.serverRun.id,
                  source: {
                    type: 'docker',
                    image: info.variant.currentVersion.dockerImage,
                    tag: info.variant.currentVersion.dockerTag
                  },
                  launchParams: launchParams.output
                });

                await manager.waitForClose;
              }
            }
          });
        })
        .notification(
          'run/closed',
          v.object({
            serverRunId: v.string()
          }),
          async data => {
            runnerManager?.handleClosed(data.serverRunId);
          }
        )
        .notification(
          'run/mcp/message',
          v.object({
            serverRunId: v.string(),
            message: v.any()
          }),
          async data => {
            runnerManager?.handleMessage(data.serverRunId, data.message);
          }
        )
        .notification(
          'run/mcp/debug',
          v.object({
            serverRunId: v.string(),
            type: v.string(),
            payload: v.any()
          }),
          async () => {
            // TODO: Store debug messages as run events
          }
        )
        .notification(
          'run/error',
          v.object({
            code: v.string(),
            message: v.string(),
            output: v.string()
          }),
          async () => {
            // TODO: handle/store run errors
          }
        );

      let connectionClosed = async () => {
        await serverRunnerConnectionService.unregisterServerRunner({
          runner
        });
        clearInterval(pingInterval!);
        pingInterval = undefined;

        await closeQueue?.();
        await transceiver?.close();

        runnerManager?.stopAll();
      };

      return {
        onOpen: (event, ws) => {
          transceiver = new MICTransceiverWebsocketServer(
            { sessionId: runner.id, connectionId: 'runner' },
            ws
          );

          session = new MICSessionManger(transceiver);

          setTimeout(() => {
            session!.notify('server/initialize', {
              id: runner.id,
              identifier: runner.identifier,
              name: runner.name
            });
          }, 1000);

          pingInterval = setInterval(async () => {
            if (Date.now() - lastPing > MAX_PING_INTERVAL) {
              await connectionClosed();

              ws.close(1000, 'Ping timeout');

              return;
            }

            ws.send('ping');
          }, SEND_PING_INTERVAL);

          endpoint.connect(session);
        },

        onMessage: async (event, ws) => {
          let data = event.data;
          if (typeof data !== 'string') return;

          if (data === 'ping') {
            lastPing = Date.now();

            // Only save every 60 seconds
            if (lastPing - lastPingSaved > PING_SAVE_INTERVAL) {
              await serverRunnerConnectionService.handleServerRunnerPing({
                runner
              });
            }

            return;
          }

          transceiver?.registerMessage(data);
        },

        onClose: async () => {
          connectionClosed();
        },
        onError: async (event, ws) => {
          connectionClosed();
        }
      };
    })
  );
};
