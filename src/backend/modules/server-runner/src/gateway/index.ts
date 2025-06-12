import { ServerDeployment, ServerRun, ServerSession } from '@metorial/db';
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
import { serverRunnerRunService } from '../services/serverRun';
import { createRunnerQueueProcessor } from './runnerQueue';

let MAX_PING_INTERVAL = 15 * 1000;
let SEND_PING_INTERVAL = 10 * 1000;
let PING_SAVE_INTERVAL = 30 * 1000;

let closeReported = new Map<string, number>();

setInterval(() => {
  // Remove old close reports older than 5 minutes
  let now = Date.now();
  for (let [id, time] of closeReported) {
    if (now - time > 5 * 60 * 1000) {
      closeReported.delete(id);
    }
  }
}, 60 * 1000);

export let createServerRunnerGateway = (
  upgradeWebSocket: UpgradeWebSocket<ServerWebSocket, any, WSEvents<ServerWebSocket>>
) => {
  return createHono()
    .get('/ping', c => c.text('OK'))
    .get(
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

        let serverRunMap = new Map<
          string,
          {
            serverRun: ServerRun;
            session: ServerSession & { serverDeployment: ServerDeployment };
          }
        >();

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

                serverRunMap.set(info.serverRun.id, info);

                debug.log(`Runner ${runner.id} - starting session run ${serverSessionId}`);

                if (!info.variant.currentVersion || !info.variant.currentVersion.dockerImage) {
                  console.error('No current version for variant', info.variant);
                  return;
                }

                try {
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
                    await serverRunnerRunService.storeServerRunLogs({
                      serverRun: info.serverRun,
                      session: info.session,
                      lines: [
                        { type: 'stderr', line: 'Get launch params function error:' },
                        ...launchParams.output.split('\n').map(line => ({
                          type: 'stderr' as const,
                          line
                        }))
                      ]
                    });

                    await serverRunnerRunService.closeServerRun({
                      serverRun: info.serverRun,
                      session: info.session,
                      result: {
                        reason: 'get_launch_params_error',
                        exitCode: 1
                      }
                    });

                    return;
                  }

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

                  let manager = new BrokerRunManager(
                    connection,
                    info.serverRun,
                    info.session,
                    info.version,
                    info.session.instance
                  );

                  debug.log(`Runner ${runner.id} - session run ${info.serverRun.id} started`);

                  await Promise.race([manager.waitForClose, runnerClosedPromise.promise]);

                  debug.log(`Runner ${runner.id} - session run ${info.serverRun.id} closed`);

                  setTimeout(() => {
                    let reported = closeReported.get(info.serverRun.id);
                    if (reported) return;

                    // The runner may have stopped or something else happened
                    // that caused the connection to close without a report
                    serverRunnerRunService.closeServerRun({
                      serverRun: info.serverRun,
                      session: info.session,
                      result: {
                        reason: 'server_stopped',
                        exitCode: 0
                      }
                    });
                  }, 10000);
                } catch (e) {
                  await serverRunnerRunService.closeServerRun({
                    serverRun: info.serverRun,
                    session: info.session,
                    result: {
                      reason: 'server_failed_to_start',
                      exitCode: 1
                    }
                  });
                }
              }
            });
          })
          .notification(
            'run/closed',
            v.object({
              serverRunId: v.string(),
              result: v.object({
                reason: v.enumOf([
                  'server_exited_success',
                  'server_exited_error',
                  'server_stopped',
                  'server_failed_to_start'
                ]),
                exitCode: v.number()
              })
            }),
            async data => {
              closeReported.set(data.serverRunId, Date.now());
              runnerManager?.handleClosed(data.serverRunId);

              let info = serverRunMap.get(data.serverRunId);
              if (!info) return;

              await serverRunnerRunService.closeServerRun({
                serverRun: info.serverRun,
                session: info.session,
                result: data.result
              });
            }
          )
          .notification(
            'run/logs',
            v.object({
              serverRunId: v.string(),
              lines: v.array(
                v.object({
                  type: v.enumOf(['stdout', 'stderr']),
                  line: v.string()
                })
              ),
              time: v.optional(v.number())
            }),
            async data => {
              let info = serverRunMap.get(data.serverRunId);
              if (!info) return;

              await serverRunnerRunService.storeServerRunLogs({
                serverRun: info.serverRun,
                session: info.session,
                lines: data.lines,
                time: data.time ? new Date(data.time) : undefined
              });
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
                console.warn(`Runner ${runner.id} ping timeout`);

                await connectionClosed();

                ws.close(1000, 'Ping timeout');

                return;
              }

              console.log(`Runner ${runner.id} sending ping`);

              ws.send('ping');
            }, SEND_PING_INTERVAL);

            endpoint.connect(session);
          },

          onMessage: async (event, ws) => {
            let data = event.data;
            if (typeof data !== 'string') return;

            if (data === 'ping') {
              lastPing = Date.now();

              console.log(`Runner ${runner.id} ping received`);

              // Only save every 60 seconds
              if (lastPing - lastPingSaved > PING_SAVE_INTERVAL) {
                await serverRunnerConnectionService.handleServerRunnerPing({
                  runner
                });
                lastPingSaved = Date.now();

                console.log(`Runner ${runner.id} ping saved`);
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
