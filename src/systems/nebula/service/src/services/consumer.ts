import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { JWT } from '@lowerdeck/jwt';
import { Paginator } from '@lowerdeck/pagination';
import { getSentry } from '@lowerdeck/sentry';
import { Service } from '@lowerdeck/service';
import type { Consumer, ConsumerInstance } from '../../prisma/generated/client';
import { db } from '../db';
import { consumerInstanceTokenTtlSeconds, consumerRegistrationSecrets, env } from '../env';
import { ID, snowflake } from '../id';
import {
  clearConsumerCache,
  clearConsumerInstanceAuthCache,
  loadConsumerById,
  loadConsumerByIdentifier,
  loadConsumerInstanceForAuth
} from '../lib/consumerCache';
import { constantTimeEqual } from '../lib/crypto';

let tokenType = 'nebula_consumer_instance';
let tokenIssuer = 'nebula';
let tokenAudience = 'nebula_consumer_instance';
let Sentry = getSentry();

type ConsumerAuthOperation = 'register' | 'refresh' | 'authenticate';

let reportConsumerAuthIssue = (
  message: string,
  context: {
    operation: ConsumerAuthOperation;
    reason: string;
    consumerId?: string | null;
    consumerIdentifier?: string | null;
    consumerInstanceId?: string | null;
  },
  error?: unknown
) => {
  let extra = {
    reason: context.reason,
    consumerId: context.consumerId ?? null,
    consumerIdentifier: context.consumerIdentifier ?? null,
    consumerInstanceId: context.consumerInstanceId ?? null
  };

  console.warn(`[nebula] Consumer ${context.operation} issue: ${message}`, extra, error);
  Sentry.captureException(error instanceof Error ? error : new Error(message), {
    tags: {
      system: 'nebula',
      operation: `consumer.${context.operation}`,
      reason: context.reason
    },
    extra
  });
};

let consumerAuthError = (
  message: string,
  context: Parameters<typeof reportConsumerAuthIssue>[1],
  error?: unknown
) => {
  reportConsumerAuthIssue(message, context, error);
  return new ServiceError(badRequestError({ message }));
};

let normalizeIdentifier = (identifier: string) => identifier.trim().toLowerCase();

let randomTokenNonce = () => {
  let buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);
  return Buffer.from(buffer).toString('hex');
};

let getTokenExpiresAt = () => new Date(Date.now() + consumerInstanceTokenTtlSeconds * 1000);

let getConsumerRegistrationSecret = (consumer: Consumer) =>
  consumerRegistrationSecrets.find(
    registration => registration.identifier === consumer.identifier
  )?.secret;

let findConsumerRegistrationBySecret = (secret: string) => {
  let matches = consumerRegistrationSecrets.filter(registration =>
    constantTimeEqual(registration.secret, secret)
  );

  if (matches.length !== 1) {
    throw consumerAuthError('Registration secret must match exactly one configured consumer', {
      operation: 'register',
      reason:
        matches.length === 0
          ? 'registration_secret_not_found'
          : 'registration_secret_ambiguous'
    });
  }

  return matches[0]!;
};

let signConsumerInstanceToken = async (d: {
  consumer: Consumer;
  consumerInstance: ConsumerInstance;
}) =>
  await JWT.sign(
    {
      type: tokenType,
      consumerId: d.consumer.id,
      consumerInstanceId: d.consumerInstance.id,
      nonce: d.consumerInstance.tokenNonce
    },
    {
      issuer: tokenIssuer,
      audience: tokenAudience,
      expiresIn: consumerInstanceTokenTtlSeconds,
      alg: 'HS256'
    },
    env.consumerAuth.CONSUMER_INSTANCE_TOKEN_SECRET
  );

type ConsumerInstanceTokenPayload = {
  type: string;
  consumerId: string;
  consumerInstanceId: string;
  nonce: string;
};

let verifyConsumerInstanceToken = async (token: string) => {
  if (!token) {
    throw consumerAuthError('Consumer token is required', {
      operation: 'authenticate',
      reason: 'missing_token'
    });
  }

  let payload: ConsumerInstanceTokenPayload;

  try {
    payload = await JWT.verify<ConsumerInstanceTokenPayload>(
      token,
      {
        issuer: tokenIssuer,
        audience: tokenAudience,
        alg: 'HS256'
      },
      env.consumerAuth.CONSUMER_INSTANCE_TOKEN_SECRET
    );
  } catch (error) {
    throw consumerAuthError(
      'Consumer token is invalid',
      {
        operation: 'authenticate',
        reason: 'invalid_token'
      },
      error
    );
  }

  if (
    payload.type !== tokenType ||
    !payload.consumerId ||
    !payload.consumerInstanceId ||
    !payload.nonce
  ) {
    throw consumerAuthError('Consumer token payload is invalid', {
      operation: 'authenticate',
      reason: 'invalid_payload',
      consumerId: payload.consumerId,
      consumerInstanceId: payload.consumerInstanceId
    });
  }

  return payload;
};

class ConsumerServiceImpl {
  async ensureEnvConsumers() {
    for (let registration of consumerRegistrationSecrets) {
      let consumer = await db.consumer.upsert({
        where: { identifier: registration.identifier },
        update: { status: 'active' },
        create: {
          oid: snowflake.nextId(),
          id: await ID.generateId('consumer'),
          name: registration.identifier,
          identifier: registration.identifier,
          status: 'active'
        }
      });

      await clearConsumerCache({
        identifier: consumer.identifier,
        id: consumer.id
      });
    }
  }

  async registerConsumerInstance(d: { secret: string; identifier: string }) {
    let registration = findConsumerRegistrationBySecret(d.secret);
    let consumer = await loadConsumerByIdentifier(registration.identifier);
    if (!consumer) {
      throw consumerAuthError('Configured consumer has not been seeded yet', {
        operation: 'register',
        reason: 'consumer_not_seeded',
        consumerIdentifier: registration.identifier
      });
    }
    if (consumer.status !== 'active') {
      throw consumerAuthError('Configured consumer is not active', {
        operation: 'register',
        reason: 'consumer_inactive',
        consumerId: consumer.id,
        consumerIdentifier: consumer.identifier
      });
    }

    let expiresAt = getTokenExpiresAt();
    try {
      let consumerInstance = await db.consumerInstance.create({
        data: {
          oid: snowflake.nextId(),
          id: await ID.generateId('consumerInstance'),
          consumerOid: consumer.oid,
          identifier: normalizeIdentifier(d.identifier),
          tokenNonce: randomTokenNonce(),
          status: 'active',
          expiresAt
        }
      });

      return {
        token: await signConsumerInstanceToken({ consumer, consumerInstance }),
        consumerInstanceId: consumerInstance.id,
        expiresAt
      };
    } catch (error) {
      throw consumerAuthError(
        'Unable to register consumer instance',
        {
          operation: 'register',
          reason: 'register_failed',
          consumerId: consumer.id,
          consumerIdentifier: consumer.identifier
        },
        error
      );
    }
  }

  async refreshConsumerInstance(d: { secret: string; token: string }) {
    let { consumer, consumerInstance } = await this.authenticateConsumerInstanceToken({
      token: d.token
    });
    let registrationSecret = getConsumerRegistrationSecret(consumer);

    if (!registrationSecret || !constantTimeEqual(registrationSecret, d.secret)) {
      throw consumerAuthError('Registration secret does not match consumer', {
        operation: 'refresh',
        reason: 'registration_secret_mismatch',
        consumerId: consumer.id,
        consumerIdentifier: consumer.identifier,
        consumerInstanceId: consumerInstance.id
      });
    }

    let expiresAt = getTokenExpiresAt();
    try {
      let updated = await db.consumerInstance.update({
        where: { oid: consumerInstance.oid },
        data: {
          tokenNonce: randomTokenNonce(),
          expiresAt,
          status: 'active'
        }
      });

      await clearConsumerInstanceAuthCache(updated.id);

      return {
        token: await signConsumerInstanceToken({ consumer, consumerInstance: updated }),
        consumerInstanceId: updated.id,
        expiresAt
      };
    } catch (error) {
      throw consumerAuthError(
        'Unable to refresh consumer instance',
        {
          operation: 'refresh',
          reason: 'refresh_failed',
          consumerId: consumer.id,
          consumerIdentifier: consumer.identifier,
          consumerInstanceId: consumerInstance.id
        },
        error
      );
    }
  }

  async authenticateConsumerInstanceToken(d: { token: string }) {
    let payload = await verifyConsumerInstanceToken(d.token);
    let consumerInstance = await loadConsumerInstanceForAuth(payload.consumerInstanceId);

    if (!consumerInstance) {
      throw consumerAuthError('Consumer instance was not found', {
        operation: 'authenticate',
        reason: 'consumer_instance_not_found',
        consumerId: payload.consumerId,
        consumerInstanceId: payload.consumerInstanceId
      });
    }
    if (consumerInstance.status !== 'active' || consumerInstance.revokedAt) {
      throw consumerAuthError('Consumer instance is not active', {
        operation: 'authenticate',
        reason: consumerInstance.revokedAt
          ? 'consumer_instance_revoked'
          : 'consumer_instance_inactive',
        consumerId: payload.consumerId,
        consumerIdentifier: consumerInstance.consumer.identifier,
        consumerInstanceId: consumerInstance.id
      });
    }
    if (consumerInstance.consumer.status !== 'active') {
      throw consumerAuthError('Consumer is not active', {
        operation: 'authenticate',
        reason: 'consumer_inactive',
        consumerId: consumerInstance.consumer.id,
        consumerIdentifier: consumerInstance.consumer.identifier,
        consumerInstanceId: consumerInstance.id
      });
    }
    if (consumerInstance.consumer.id !== payload.consumerId) {
      throw consumerAuthError('Consumer token does not match its instance', {
        operation: 'authenticate',
        reason: 'consumer_mismatch',
        consumerId: payload.consumerId,
        consumerIdentifier: consumerInstance.consumer.identifier,
        consumerInstanceId: consumerInstance.id
      });
    }
    if (consumerInstance.tokenNonce !== payload.nonce) {
      throw consumerAuthError('Consumer token has been rotated or revoked', {
        operation: 'authenticate',
        reason: 'nonce_mismatch',
        consumerId: consumerInstance.consumer.id,
        consumerIdentifier: consumerInstance.consumer.identifier,
        consumerInstanceId: consumerInstance.id
      });
    }
    if (consumerInstance.expiresAt.getTime() <= Date.now()) {
      throw consumerAuthError('Consumer token has expired', {
        operation: 'authenticate',
        reason: 'token_expired',
        consumerId: consumerInstance.consumer.id,
        consumerIdentifier: consumerInstance.consumer.identifier,
        consumerInstanceId: consumerInstance.id
      });
    }

    try {
      await db.consumerInstance.update({
        where: { oid: consumerInstance.oid },
        data: { lastUsedAt: new Date() }
      });
    } catch (error) {
      throw consumerAuthError(
        'Unable to update consumer instance usage',
        {
          operation: 'authenticate',
          reason: 'last_used_update_failed',
          consumerId: consumerInstance.consumer.id,
          consumerIdentifier: consumerInstance.consumer.identifier,
          consumerInstanceId: consumerInstance.id
        },
        error
      );
    }

    return {
      consumer: consumerInstance.consumer,
      consumerInstance
    };
  }

  async getConsumerById(d: { id: string }) {
    let consumer = await loadConsumerById({ id: d.id });
    if (!consumer) throw new ServiceError(notFoundError('consumer'));
    return consumer;
  }

  async listConsumers() {
    return Paginator.create(({ prisma }) =>
      prisma(async opts =>
        db.consumer.findMany({
          ...opts,
          orderBy: { createdAt: 'desc' }
        })
      )
    );
  }
}

export let consumerService = Service.create(
  'consumerService',
  () => new ConsumerServiceImpl()
).build();
