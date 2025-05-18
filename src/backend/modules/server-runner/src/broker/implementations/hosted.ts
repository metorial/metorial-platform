import { ServerRun } from '@metorial/db';
import { MICSessionManger } from '@metorial/interconnect';
import { BrokerRunnerImplementationExternal } from './external';

export class RunnerBrokerManager {
  #runners: Map<string, BrokerRunnerImplementationExternal> = new Map();

  constructor(private manager: MICSessionManger) {}

  async create(run: ServerRun, opts: { url: string; token: string }) {
    let runner = await BrokerRunnerImplementationExternal.create(run, {
      url: opts.url,
      transport: 'mcp/sse',
      headers: { 'Metorial-Runner-Token': opts.token }
    });
    runner.onClose(() => {
      this.#runners.delete(run.id);
    });

    this.#runners.set(run.id, runner);

    return runner;
  }

  handleClosed(runId: string) {
    let runner = this.#runners.get(runId);
    if (!runner) return;

    runner.close();
  }

  stopAll() {
    for (let runner of this.#runners.values()) {
      runner.close();
    }
  }
}
