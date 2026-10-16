import { mapObject } from '@metorial/util-resource-mapper/compact';

export type IdentitiesDelegationConfigsUpdateOutput = {
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

export let mapIdentitiesDelegationConfigsUpdateOutput =
  /* @__PURE__ */ mapObject<IdentitiesDelegationConfigsUpdateOutput>(
    [
      'is_default',
      'sub_delegation_behavior',
      'sub_delegation_depth',
      'created_at',
      'updated_at'
    ],
    1
  );

export type IdentitiesDelegationConfigsUpdateBody = {
  name?: string | undefined;
  description?: string | undefined;
  metadata?: Record<string, any> | undefined;
  subDelegationBehavior?: 'allow' | 'deny' | 'require_consent' | undefined;
  subDelegationDepth?: number | undefined;
};

export let mapIdentitiesDelegationConfigsUpdateBody =
  /* @__PURE__ */ mapObject<IdentitiesDelegationConfigsUpdateBody>([
    'sub_delegation_behavior',
    'sub_delegation_depth'
  ]);
