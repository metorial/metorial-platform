import { mapObject } from '@metorial/util-resource-mapper/compact';

export type DashboardInstanceProvidersTriggersGetOutput = {
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
};

export let mapDashboardInstanceProvidersTriggersGetOutput =
  /* @__PURE__ */ mapObject<DashboardInstanceProvidersTriggersGetOutput>(
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
                ['interval_seconds', 'auto_registration', 'auto_unregistration']
              ]
            ]
          ]
        ]
      ],
      'provider_id',
      'provider_specification_id',
      'created_at',
      'updated_at'
    ],
    1
  );
