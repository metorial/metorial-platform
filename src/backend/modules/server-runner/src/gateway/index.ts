import { debug } from '@metorial/debug';
import { ServiceError, unauthorizedError } from '@metorial/error';
import { createHono } from '@metorial/hono';
import { MICEndpoint, MICSessionManger } from '@metorial/interconnect';
import { MICTransceiverWebsocketServer } from '@metorial/interconnect-websocket-server';
import { ProgrammablePromise } from '@metorial/programmable-promise';
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

      let runnerClosedPromise = new ProgrammablePromise<void>();

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
          debug.log(`Runner ${runner.id} connection ready`);

          runnerManager = new RunnerBrokerManager(session!);

          closeQueue = await createRunnerQueueProcessor(runner, {
            start_session_run: async ({ serverSessionId }) => {
              let info = await RunJobProcessorUtils.createServerRun({
                serverSessionId,
                runner
              });
              if (!info) return;

              debug.log(`Runner ${runner.id} - starting session run ${serverSessionId}`);

              if (!info.variant.currentVersion || !info.variant.currentVersion.dockerImage) {
                console.error('No current version for variant', info.variant);
                return;
              }

              let launchParams = await session!.request(
                'get_launch_params',
                {
                  config: info.DANGEROUSLY_UNENCRYPTED_CONFIG,
                  getLaunchParams:
                    info.implementation.getLaunchParams ?? info.version.getLaunchParams
                },
                v.union([
                  v.object({
                    type: v.literal('error'),
                    output: v.string()
                  }),
                  v.object({
                    type: v.literal('success'),
                    output: v.any()
                  })
                ])
              );

              if (launchParams.type == 'error') {
                // TODO: run failed
              } else {
                let startRes = await session!.request(
                  'run/start',
                  {
                    serverRunId: info.serverRun.id,
                    source: {
                      type: 'docker',
                      image: info.variant.currentVersion.dockerImage,
                      tag: info.variant.currentVersion.dockerTag
                    },
                    launchParams: launchParams.output
                  },
                  v.object({
                    token: v.string(),
                    url: v.string()
                  })
                );

                // TODO: once we add self-hosted runners, we need to perform an
                // SSRF check here to make sure the URL is valid and not pointing
                // to a local address

                let connection = await runnerManager!.create(info.serverRun, {
                  url: startRes.url,
                  token: startRes.token
                });

                let manager = new BrokerRunManager(connection, info.serverRun, info.session);

                debug.log(`Runner ${runner.id} - session run ${info.serverRun.id} started`);

                await Promise.race([manager.waitForClose, runnerClosedPromise.promise]);

                debug.log(`Runner ${runner.id} - session run ${info.serverRun.id} closed`);
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
        debug.log(`Runner ${runner.id} connection closed`);

        await serverRunnerConnectionService.unregisterServerRunner({
          runner
        });
        clearInterval(pingInterval!);
        pingInterval = undefined;

        runnerClosedPromise.resolve();

        await closeQueue?.();
        await transceiver?.close();

        runnerManager?.stopAll();
      };

      process.on('SIGINT', async () => {
        await connectionClosed();
      });

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
