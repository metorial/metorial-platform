import { db, getId, type ProviderRun } from '@metorial-subspace/db';
import { isRecordDeleted } from '@metorial-subspace/list-utils';
import { getBackend } from '@metorial-subspace/provider';
import type {
  ConnectionSpecificationBehavior,
  ProviderRuntimeBehavior
} from '@metorial-subspace/provider-utils';
import { Store } from '@metorial-subspace/store';
import { addMinutes } from 'date-fns';
import { SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT } from '../../const';
import { resolveConnectionTimeouts } from '../../lib/timeouts';
import { type ConnectionBaseState, getConnectionBaseState } from './base';
import { createProviderRun } from './providerRun';

export class ConnectionState {
  #instanceExtensionIv: NodeJS.Timeout;
  #refetchIv: NodeJS.Timeout;
  #lastMessageAt = new Store<Date | null>(null);

  private constructor(
    private baseState: ConnectionBaseState,
    public providerRun: ProviderRun,
    public readonly runtimeBehavior: ProviderRuntimeBehavior,
    public readonly connectionSpecificationBehavior: ConnectionSpecificationBehavior,
    onError: () => void
  ) {
    this.#instanceExtensionIv = setInterval(async () => {
      await db.sessionProviderInstance.updateMany({
        where: { oid: baseState.instance.oid },
        data: {
          lastUsedAt: this.#lastMessageAt.value ?? undefined,
          lastRenewedAt: new Date(),
          expiresAt: addMinutes(new Date(), SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT)
        }
      });

      await db.providerRun.updateMany({
        where: { oid: this.providerRun.oid },
        data: { lastPingAt: new Date() }
      });

      this.#lastMessageAt.set(null);
    }, 1000 * 60);

    this.#refetchIv = setInterval(async () => {
      let baseRes = await getConnectionBaseState({
        connectionOid: baseState.connection.oid,
        instanceOid: baseState.instance.oid
      });
      let updatedProviderRun = await db.providerRun.findFirstOrThrow({
        where: { oid: this.providerRun.oid }
      });

      if (!baseRes || isRecordDeleted(updatedProviderRun)) {
        onError();
        this.dispose();
        return;
      }

      this.baseState = baseRes;
      this.providerRun = updatedProviderRun;
    }, 1000 * 60);
  }

  static async create(d: { instanceOid: bigint; connectionOid: bigint }, onError: () => void) {
    let baseState = await getConnectionBaseState(d);
    if (!baseState) return undefined;

    let backend = await getBackend({ entity: baseState.version });
    let runtimeBehavior = backend.providerRun.getRuntimeBehavior();
    let connectionSpecificationBehavior =
      await backend.capabilities.getConnectionSpecificationBehavior({
        providerVersion: baseState.version
      });

    let providerRun = await createProviderRun(baseState);

    return new ConnectionState(
      baseState,
      providerRun,
      runtimeBehavior,
      connectionSpecificationBehavior,
      onError
    );
  }

  get timeouts() {
    return resolveConnectionTimeouts({
      runtimeBehavior: this.runtimeBehavior,
      tenantMessageProcessingTimeoutMs: this.sessionProvider.tenant.messageProcessingTimeoutMs,
      isEphemeral: this.session.isEphemeral || this.connection.isEphemeral
    });
  }

  get messageTTLExtensionMs() {
    return this.timeouts.messageTtlExtensionMs;
  }

  get messageProcessingTimeoutMs() {
    return this.timeouts.messageProcessingTimeoutMs;
  }

  get connection() {
    return this.baseState.connection;
  }

  get participant() {
    return this.baseState.participant;
  }

  get instance() {
    return this.baseState.instance;
  }

  get session() {
    return this.baseState.session;
  }

  get version() {
    return this.baseState.version;
  }

  get provider() {
    return this.baseState.provider;
  }

  get backend() {
    return this.baseState.backend;
  }

  get sessionProvider() {
    return this.baseState.sessionProvider;
  }

  #isDisposed = false;
  async dispose() {
    if (this.#isDisposed) return;
    this.#isDisposed = true;

    clearInterval(this.#instanceExtensionIv);
    clearInterval(this.#refetchIv);

    await db.sessionEvent.createMany({
      data: {
        ...getId('sessionEvent'),
        type: 'provider_run_stopped',
        sessionOid: this.session.oid,
        connectionOid: this.connection.oid,
        providerRunOid: this.providerRun.oid,
        tenantOid: this.session.tenantOid,
        solutionOid: this.session.solutionOid,
        environmentOid: this.session.environmentOid
      }
    });

    await db.providerRun.updateMany({
      where: { oid: this.providerRun.oid },
      data: {
        status: 'stopped',
        completedAt: new Date()
      }
    });
  }
}
