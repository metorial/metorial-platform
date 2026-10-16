import { mapObject } from '@metorial/util-resource-mapper/compact';

export type IdentitiesDelegationConfigsDeleteOutput = {
  object: 'identity.delegation_config';
  id: string;
  status: 'active' | 'archived' | 'deleted';
  isDefault: boolean;
  name: string | null;
  description: string | null;
  metadata: Record<string, any> | null;
  subDelegationBehavior: 'allow' | 'deny' | 'require_consent';
  subDelegationDepth: number;
  createdAt: Date;
  updatedAt: Date;
};

export let mapIdentitiesDelegationConfigsDeleteOutput =
  /* @__PURE__ */ mapObject<IdentitiesDelegationConfigsDeleteOutput>(
    [
      'is_default',
      'sub_delegation_behavior',
      'sub_delegation_depth',
      'created_at',
      'updated_at'
    ],
    1
  );
