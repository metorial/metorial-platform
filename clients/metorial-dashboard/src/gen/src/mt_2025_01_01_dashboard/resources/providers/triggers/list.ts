import { createMapper } from '@metorial/util-resource-mapper/compact';

export type ProvidersTriggersListOutput = {
  items: {
    object: 'provider.capabilities.trigger';
    id: string;
    key: string;
    name: string;
    description: string | null;
    inputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
    outputSchema: { type: 'json_schema'; schema: Record<string, any> } | null;
    invocation:
      | { type: 'polling'; intervalSeconds: number }
      | {
          type: 'webhook';
          autoRegistration: { status: 'supported' | 'unsupported' };
          autoUnregistration: { status: 'supported' | 'unsupported' };
        };
    providerId: string;
    providerSpecificationId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapProvidersTriggersListOutput =
  /* @__PURE__ */ createMapper<ProvidersTriggersListOutput>(
    [
      7,
      [
        1,
        [
          'input_schema',
          'output_schema',
          [
            'invocation',
            0,
            [
              3,
              [
                [
                  0,
                  [
                    1,
                    [
                      'interval_seconds',
                      'auto_registration',
                      'auto_unregistration'
                    ]
                  ]
                ]
              ]
            ]
          ],
          'provider_id',
          'provider_specification_id',
          'created_at',
          'updated_at'
        ]
      ]
    ],
    1
  );

export type ProvidersTriggersListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & { providerVersionId: string };

export let mapProvidersTriggersListQuery =
  /* @__PURE__ */ createMapper<ProvidersTriggersListQuery>([
    3,
    [[0, [1, ['provider_version_id']]]]
  ]);
