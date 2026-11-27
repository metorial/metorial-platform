import { db, getId, type ProviderRun } from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
import type {
  ConnectionSpecificationBehavior,
  ProviderRuntimeBehavior
} from '@metorial-subspace/provider-utils';
import { Store } from '@metorial-subspace/store';
import { addMinutes } from 'date-fns';
import { SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT } from '../../const';
import { resolveConnectionTimeouts } from '../../lib/timeouts';
import {
  type ConnectionBaseState,
  getConnectionBaseState,
  getConnectionLiveness,
  getConnectionStateFingerprint
} from './base';
import { createProviderRun } from './providerRun';

export class ConnectionState {
  #instanceExtensionIv: NodeJS.Timeout;
  #refetchIv: NodeJS.Timeout;
  #lastMessageAt = new Store<Date | null>(null);
  #fingerprint: string;

  private constructor(
    private baseState: ConnectionBaseState,
    public providerRun: ProviderRun,
    public readonly runtimeBehavior: ProviderRuntimeBehavior,
    public readonly connectionSpecificationBehavior: ConnectionSpecificationBehavior,
    onError: () => void
  ) {
    this.#fingerprint = getConnectionStateFingerprint(baseState.sessionProvider);

    this.#instanceExtensionIv = setInterval(() => {
      this.extendInstance().catch(err =>
        console.error('CONNECTION.state.extend_instance_failed', err)
      );
    }, 1000 * 60);

    this.#refetchIv = setInterval(() => {
      this.refresh(onError).catch(err => console.error('CONNECTION.state.refresh_failed', err));
    }, 1000 * 60);
  }

  // These writes are the liveness signal the provider-run and instance sweeps rely on, so
  // they run every interval regardless of traffic.
  private async extendInstance() {
    let lastMessageAt = this.#lastMessageAt.value;
    this.#lastMessageAt.set(null);

    await Promise.all([
      db.sessionProviderInstance.updateMany({
        where: { oid: this.baseState.instance.oid },
        data: {
          lastUsedAt: lastMessageAt ?? undefined,
          lastRenewedAt: new Date(),
          expiresAt: addMinutes(new Date(), SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT)
        }
      }),

      db.providerRun.updateMany({
        where: { oid: this.providerRun.oid },
        data: { lastPingAt: new Date() }
      })
    ]);
  }

  private async refresh(onError: () => void) {
    let target = {
      connectionOid: this.baseState.connection.oid,
      instanceOid: this.baseState.instance.oid
    };

    let liveness = await getConnectionLiveness(target);
    if (!liveness) {
      onError();
      await this.dispose();
      return;
    }

    if (liveness.fingerprint === this.#fingerprint) return;

    let baseRes = await getConnectionBaseState(target);
    if (!baseRes) {
      onError();
      await this.dispose();
      return;
    }

    this.baseState = baseRes;
    this.#fingerprint = getConnectionStateFingerprint(baseRes.sessionProvider);
  }

  markMessageReceived() {
    this.#lastMessageAt.set(new Date());
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
        projectOid: this.session.projectOid,
        solutionOid: this.session.solutionOid,
        environmentOid: this.session.environmentOid,
        instanceOid: this.session.instanceOid
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
