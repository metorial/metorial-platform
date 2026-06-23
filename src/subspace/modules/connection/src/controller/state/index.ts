import { db, getId, type ProviderRun } from '@metorial-subspace/db';
import { isRecordDeleted } from '@metorial-subspace/list-utils';
import { Store } from '@metorial-subspace/store';
import { addMinutes } from 'date-fns';
import { SESSION_PROVIDER_INSTANCE_EXPIRATION_INCREMENT } from '../../const';
import { type ConnectionBaseState, getConnectionBaseState } from './base';
import { createProviderRun } from './providerRun';

export class ConnectionState {
  #instanceExtensionIv: NodeJS.Timeout;
  #refetchIv: NodeJS.Timeout;
  #lastMessageAt = new Store<Date | null>(null);

  private constructor(
    private baseState: ConnectionBaseState,
    public providerRun: ProviderRun,
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

    let providerRun = await createProviderRun(baseState);

    return new ConnectionState(baseState, providerRun, onError);
  }

  get messageTTLExtensionMs() {
    if (this.session.isEphemeral || this.connection.isEphemeral) {
      return 1000 * 15;
    }

    if (this.backend.type === 'slates') {
      return 1000 * 30;
    }

    return 1000 * 60 * 2;
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
