import { mtMap } from '@metorial/util-resource-mapper';

export type FirewallsListOutput = {
  items: {
    object: 'network.firewall';
    id: string;
    slug: string;
    name: string;
    description: string | null;
    status: 'active' | 'archived' | 'deleted';
    networkId: string;
    networkPolicies: {
      object: 'network.policy#preview';
      id: string;
      name: string;
      version: number;
      rules: {
        object: 'network.policy.rule';
        id: string;
        effect: 'allow' | 'deny';
        direction: 'ingress' | 'egress';
        cidrs: string[];
        description: string | null;
        enabled: boolean;
        priority: number;
        ports:
          | { object: 'network.policy.port_range'; from: number; to: number }[]
          | null;
      }[];
    }[];
    createdAt: Date;
    updatedAt: Date;
    archivedAt: Date | null;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapFirewallsListOutput = mtMap.object<FirewallsListOutput>({
  items: mtMap.objectField(
    'items',
    mtMap.array(
      mtMap.object({
        object: mtMap.objectField('object', mtMap.passthrough()),
        id: mtMap.objectField('id', mtMap.passthrough()),
        slug: mtMap.objectField('slug', mtMap.passthrough()),
        name: mtMap.objectField('name', mtMap.passthrough()),
        description: mtMap.objectField('description', mtMap.passthrough()),
        status: mtMap.objectField('status', mtMap.passthrough()),
        networkId: mtMap.objectField('network_id', mtMap.passthrough()),
        networkPolicies: mtMap.objectField(
          'network_policies',
          mtMap.array(
            mtMap.object({
              object: mtMap.objectField('object', mtMap.passthrough()),
              id: mtMap.objectField('id', mtMap.passthrough()),
              name: mtMap.objectField('name', mtMap.passthrough()),
              version: mtMap.objectField('version', mtMap.passthrough()),
              rules: mtMap.objectField(
                'rules',
                mtMap.array(
                  mtMap.object({
                    object: mtMap.objectField('object', mtMap.passthrough()),
                    id: mtMap.objectField('id', mtMap.passthrough()),
                    effect: mtMap.objectField('effect', mtMap.passthrough()),
                    direction: mtMap.objectField(
                      'direction',
                      mtMap.passthrough()
                    ),
                    cidrs: mtMap.objectField(
                      'cidrs',
                      mtMap.array(mtMap.passthrough())
                    ),
                    description: mtMap.objectField(
                      'description',
                      mtMap.passthrough()
                    ),
                    enabled: mtMap.objectField('enabled', mtMap.passthrough()),
                    priority: mtMap.objectField(
                      'priority',
                      mtMap.passthrough()
                    ),
                    ports: mtMap.objectField(
                      'ports',
                      mtMap.array(
                        mtMap.object({
                          object: mtMap.objectField(
                            'object',
                            mtMap.passthrough()
                          ),
                          from: mtMap.objectField('from', mtMap.passthrough()),
                          to: mtMap.objectField('to', mtMap.passthrough())
                        })
                      )
                    )
                  })
                )
              )
            })
          )
        ),
        createdAt: mtMap.objectField('created_at', mtMap.date()),
        updatedAt: mtMap.objectField('updated_at', mtMap.date()),
        archivedAt: mtMap.objectField('archived_at', mtMap.date())
      })
    )
  ),
  pagination: mtMap.objectField(
    'pagination',
    mtMap.object({
      hasMoreBefore: mtMap.objectField('has_more_before', mtMap.passthrough()),
      hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
    })
  )
});

export type FirewallsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {
  id?: string | string[] | undefined;
  slug?: string | string[] | undefined;
  status?:
    | 'active'
    | 'archived'
    | 'deleted'
    | ('active' | 'archived' | 'deleted')[]
    | undefined;
  networkId?: string | string[] | undefined;
  enclaveId?: string | string[] | undefined;
  providerId?: string | string[] | undefined;
  networkPolicyId?: string | string[] | undefined;
  createdAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
  updatedAt?: { gt?: Date | undefined; lt?: Date | undefined } | undefined;
};

export let mapFirewallsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough()),
      id: mtMap.objectField(
        'id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      slug: mtMap.objectField(
        'slug',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      status: mtMap.objectField(
        'status',
        mtMap.union([mtMap.unionOption('array', mtMap.union([]))])
      ),
      networkId: mtMap.objectField(
        'network_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      enclaveId: mtMap.objectField(
        'enclave_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      providerId: mtMap.objectField(
        'provider_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      networkPolicyId: mtMap.objectField(
        'network_policy_id',
        mtMap.union([
          mtMap.unionOption('string', mtMap.passthrough()),
          mtMap.unionOption(
            'array',
            mtMap.union([mtMap.unionOption('string', mtMap.passthrough())])
          )
        ])
      ),
      createdAt: mtMap.objectField(
        'created_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      ),
      updatedAt: mtMap.objectField(
        'updated_at',
        mtMap.object({
          gt: mtMap.objectField('gt', mtMap.date()),
          lt: mtMap.objectField('lt', mtMap.date())
        })
      )
    })
  )
]);

