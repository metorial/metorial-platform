import type { FunctionBayLayer, FunctionBayRuntimeSpec } from '@function-bay/types';
import { createDatabase } from '@lowerdeck/prisma-pg';
import { PrismaClient } from '../prisma/generated/client';

export let { db } = createDatabase({
  name: 'functions',
  url: ['FUNCTION_BAY_DATABASE_URL', 'DATABASE_URL'],
  createClient: adapter =>
    new PrismaClient({
      adapter,
      transactionOptions: {
        maxWait: 10000,
        timeout: 12000
      }
    })
});

declare global {
  namespace PrismaJson {
    type PortRange = {
      from: number;
      to: number;
    };

    type CompiledNetworkAllowEntry = {
      cidr: string;
      portRange?: PortRange;
    };

    type CompiledNetworkAllowList = {
      direction: 'ingress' | 'egress';
      entries: CompiledNetworkAllowEntry[];
    };

    type CompiledEgressNetworkAllowList = {
      direction: 'egress';
      entries: CompiledNetworkAllowEntry[];
    };

    interface FunctionConfiguration {
      memorySizeMb: number;
      timeoutSeconds: number;
      disableNetworkIsolation?: boolean;
      concurrency?: 'exclusive' | 'shared';
      sandbox?: 'runc' | 'gvisor';
      egress?: CompiledEgressNetworkAllowList;
    }

    interface RuntimeConfiguration {
      runtime: FunctionBayRuntimeSpec;
      layer: FunctionBayLayer;
    }
  }
}
