import { ServerRun } from '@metorial/db';
import { MICSessionManger } from '@metorial/interconnect';
import { type JSONRPCMessage } from '@metorial/mcp-utils';
import { getSentry } from '@metorial/sentry';
import { BrokerRunnerImplementation } from './base';

let Sentry = getSentry();

export class BrokerRunnerImplementationHosted extends BrokerRunnerImplementation {
  constructor(
    private readonly run: ServerRun,
    private manager: MICSessionManger
  ) {
    super(BrokerRunnerImplementation.createEmitter());

    // The runner takes care of sending pings to the MCP servers
    this.doSendPing = false;
  }

  protected async sendMessageImpl(message: JSONRPCMessage) {
    this.manager.notify('run/mcp/message', {
      serverRunId: this.run.id,
      message: message
    });
  }

  protected async closeImpl() {
    this.manager.notify('run/close', {
      serverRunId: this.run.id
    });

    // @ts-ignore
    this.manager = undefined;
  }

  async handleClosed() {
    await this.close();
  }

  async handleMessage(message: JSONRPCMessage) {
    this.emitter.emit('message', message);
  }
}

export class RunnerBrokerManager {
  #runners: Map<string, BrokerRunnerImplementationHosted> = new Map();

  constructor(private manager: MICSessionManger) {}

  create(run: ServerRun) {
    let runner = new BrokerRunnerImplementationHosted(run, this.manager);
    runner.onClose(() => {
      this.#runners.delete(run.id);
    });

    this.#runners.set(run.id, runner);

    return runner;
  }

  handleMessage(runId: string, message: JSONRPCMessage) {
    let runner = this.#runners.get(runId);
    if (!runner) return;

    runner.handleMessage(message);
  }

  handleClosed(runId: string) {
    let runner = this.#runners.get(runId);
    if (!runner) return;

    runner
      .handleClosed()
      .then(() => {
        this.#runners.delete(runId);
      })
      .catch(err => {
        Sentry.captureException(err, {
          tags: { runnerId: runId },
          extra: { message: 'Error closing runner' }
        });
      });
  }

  stopAll() {
    for (let runner of this.#runners.values()) {
      runner.close();
    }
  }
}
