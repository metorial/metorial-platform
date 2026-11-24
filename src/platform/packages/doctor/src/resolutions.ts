import {
  describeError,
  type CheckContext,
  type CheckOutcome,
  type ErrorKind,
  type ResolutionInput
} from '@lowerdeck/doctor';

export type Infrastructure =
  'postgres' | 'redis' | 'mongodb' | 'nats' | 'object-storage' | 'dependency';

type Catalog = Partial<Record<ErrorKind, ResolutionInput>>;

let networkSteps = (what: string, envNames: string) => [
  `Check the host and port in ${envNames}.`,
  `Check that ${what} is running and accepts connections from the cluster.`,
  'Check that network policies, security groups and firewalls allow egress from Metorial to it.'
];

let catalog: Record<Infrastructure, Catalog> = {
  postgres: {
    authentication: {
      summary: 'PostgreSQL rejected the username or password.',
      steps: [
        'Check the user and password in the database URL.',
        'Percent-encode special characters in the password (for example @, :, / and #).',
        'If the password was rotated, update the Metorial secret and restart the pods.'
      ],
      docs: 'datacenter/operations/doctor#postgres'
    },
    not_found: {
      summary: 'The database does not exist.',
      steps: [
        'Give the Metorial user CREATEDB so the bootstrap Job can create its databases,',
        'or create every database listed in the installation guide before installing.'
      ],
      docs: 'datacenter/operations/doctor#postgres'
    },
    permission: {
      summary: 'The PostgreSQL user lacks a permission Metorial needs.',
      steps: ['Grant the user ownership of the Metorial databases, or CREATEDB.'],
      docs: 'datacenter/operations/doctor#postgres'
    },
    tls: {
      summary: 'The TLS handshake with PostgreSQL failed.',
      steps: [
        'Check sslmode in the database URL: the server may require TLS, or not support it.',
        'If the server uses a private CA, mount the CA bundle and reference it.'
      ],
      docs: 'datacenter/operations/doctor#postgres'
    },
    connection_refused: {
      summary: 'Nothing accepted the connection to PostgreSQL.',
      steps: networkSteps('PostgreSQL', 'the database URL'),
      docs: 'datacenter/operations/doctor#postgres'
    },
    dns: {
      summary: 'The PostgreSQL host name does not resolve.',
      steps: networkSteps('PostgreSQL', 'the database URL'),
      docs: 'datacenter/operations/doctor#postgres'
    },
    timeout: {
      summary: 'PostgreSQL did not answer in time.',
      steps: networkSteps('PostgreSQL', 'the database URL'),
      docs: 'datacenter/operations/doctor#postgres'
    },
    limit: {
      summary: 'PostgreSQL ran out of connections.',
      steps: [
        'Raise max_connections to at least 1000, or put a connection pooler in front.',
        'Check for other applications holding connections on the same server.'
      ],
      docs: 'datacenter/operations/doctor#postgres'
    }
  },
  redis: {
    authentication: {
      summary: 'Redis rejected the password.',
      steps: [
        'Check the password in the Redis URL (redis://:password@host:6379).',
        'Percent-encode special characters in the password.'
      ],
      docs: 'datacenter/operations/doctor#redis'
    },
    connection_reset: {
      summary: 'Redis closed the connection.',
      steps: [
        'Use rediss:// when the server requires TLS, and redis:// when it does not.',
        'Check the server logs for rejected clients.'
      ],
      docs: 'datacenter/operations/doctor#redis'
    },
    tls: {
      summary: 'The TLS handshake with Redis failed.',
      steps: ['Use redis:// when the server does not support TLS.'],
      docs: 'datacenter/operations/doctor#redis'
    },
    connection_refused: {
      summary: 'Nothing accepted the connection to Redis.',
      steps: networkSteps('Redis', 'the Redis URL'),
      docs: 'datacenter/operations/doctor#redis'
    },
    dns: {
      summary: 'The Redis host name does not resolve.',
      steps: networkSteps('Redis', 'the Redis URL'),
      docs: 'datacenter/operations/doctor#redis'
    },
    timeout: {
      summary: 'Redis did not answer in time.',
      steps: networkSteps('Redis', 'the Redis URL'),
      docs: 'datacenter/operations/doctor#redis'
    }
  },
  mongodb: {
    authentication: {
      summary: 'MongoDB rejected the credentials.',
      steps: [
        'Check the user, password and authSource in the MongoDB URL.',
        'Percent-encode special characters in the password.'
      ],
      docs: 'datacenter/operations/doctor#mongodb'
    },
    unavailable: {
      summary: 'No usable MongoDB server was found.',
      steps: [
        'Check that the replica set is initiated and has a primary.',
        'Check replicaSet= and the host list in the MongoDB URL.',
        ...networkSteps('MongoDB', 'the MongoDB URL').slice(2)
      ],
      docs: 'datacenter/operations/doctor#mongodb'
    },
    tls: {
      summary: 'The TLS handshake with MongoDB failed.',
      steps: ['Check tls= in the URL and the configured CA bundle.'],
      docs: 'datacenter/operations/doctor#mongodb'
    },
    timeout: {
      summary: 'MongoDB did not answer in time.',
      steps: networkSteps('MongoDB', 'the MongoDB URL'),
      docs: 'datacenter/operations/doctor#mongodb'
    }
  },
  nats: {
    connection_refused: {
      summary: 'Nothing accepted the connection to NATS.',
      steps: networkSteps('NATS', 'the NATS URL'),
      docs: 'datacenter/operations/doctor#nats'
    },
    authentication: {
      summary: 'NATS rejected the credentials.',
      steps: ['Check the user, password or token in the NATS URL.'],
      docs: 'datacenter/operations/doctor#nats'
    },
    timeout: {
      summary: 'NATS did not answer in time.',
      steps: networkSteps('NATS', 'the NATS URL'),
      docs: 'datacenter/operations/doctor#nats'
    }
  },
  'object-storage': {
    connection_refused: {
      summary: 'The object storage service is not reachable.',
      steps: [
        'Check that the object-storage pods are running.',
        'Check that network policies allow traffic to object-storage on port 8081.'
      ],
      docs: 'datacenter/operations/doctor#object-storage'
    },
    permission: {
      summary: 'The storage backend denied the operation.',
      steps: [
        'Check the object-storage doctor report: it names the backend error.',
        'Grant read, write and delete on the bucket to the role or keys object-storage uses.'
      ],
      docs: 'datacenter/operations/doctor#object-storage'
    },
    unavailable: {
      summary: 'The storage backend is unavailable.',
      steps: ['Check the object-storage doctor report: it names the backend error.'],
      docs: 'datacenter/operations/doctor#object-storage'
    }
  },
  dependency: {
    authentication: {
      summary: 'The service rejected our credentials.',
      steps: [
        'Every component must use the same installation secret (masterSecret).',
        'Re-apply the chart so all components get the same Secret, then restart them.'
      ],
      docs: 'datacenter/operations/doctor#dependencies'
    },
    connection_refused: {
      summary: 'The service is not reachable.',
      steps: [
        'Check that its pods are running and ready.',
        'Check that network policies allow traffic between the two components.'
      ],
      docs: 'datacenter/operations/doctor#dependencies'
    },
    timeout: {
      summary: 'The service did not answer in time.',
      steps: [
        'Check the logs of the service for slow startup or overload.',
        'Check that network policies allow traffic between the two components.'
      ],
      docs: 'datacenter/operations/doctor#dependencies'
    }
  }
};

export let resolutionFor = (infrastructure: Infrastructure, kind: ErrorKind) =>
  catalog[infrastructure][kind] ?? null;

export let failFromError = (
  ctx: CheckContext,
  infrastructure: Infrastructure,
  error: unknown,
  details: Record<string, unknown> = {}
): CheckOutcome => {
  let info = describeError(error);
  let resolution = resolutionFor(infrastructure, info.kind) ??
    (info.hint ? { summary: info.hint, steps: [], docs: null } : null);

  return ctx.fail({
    message: info.message,
    resolution,
    details: { ...details, errorKind: info.kind, errorCode: info.code }
  });
};

export let attempt = async (
  ctx: CheckContext,
  infrastructure: Infrastructure,
  run: () => Promise<CheckOutcome | void>,
  details?: Record<string, unknown>
) => {
  try {
    return await run();
  } catch (error) {
    return failFromError(ctx, infrastructure, error, details);
  }
};
