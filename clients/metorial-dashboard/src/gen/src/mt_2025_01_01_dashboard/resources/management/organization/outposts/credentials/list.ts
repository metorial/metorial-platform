import { mtMap } from '@metorial/util-resource-mapper';

export type ManagementOrganizationOutpostsCredentialsListOutput = {
  items: {
    object: 'outpost_credential';
    id: string;
    status: 'active' | 'disabled' | 'deleted' | 'expired';
    outpostId: string;
    name: string;
    envelopePreview: string;
    envelope: string | null;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }[];
  pagination: { hasMoreBefore: boolean; hasMoreAfter: boolean };
};

export let mapManagementOrganizationOutpostsCredentialsListOutput =
  mtMap.object<ManagementOrganizationOutpostsCredentialsListOutput>({
    items: mtMap.objectField(
      'items',
      mtMap.array(
        mtMap.object({
          object: mtMap.objectField('object', mtMap.passthrough()),
          id: mtMap.objectField('id', mtMap.passthrough()),
          status: mtMap.objectField('status', mtMap.passthrough()),
          outpostId: mtMap.objectField('outpost_id', mtMap.passthrough()),
          name: mtMap.objectField('name', mtMap.passthrough()),
          envelopePreview: mtMap.objectField(
            'envelope_preview',
            mtMap.passthrough()
          ),
          envelope: mtMap.objectField('envelope', mtMap.passthrough()),
          expiresAt: mtMap.objectField('expires_at', mtMap.date()),
          createdAt: mtMap.objectField('created_at', mtMap.date()),
          updatedAt: mtMap.objectField('updated_at', mtMap.date())
        })
      )
    ),
    pagination: mtMap.objectField(
      'pagination',
      mtMap.object({
        hasMoreBefore: mtMap.objectField(
          'has_more_before',
          mtMap.passthrough()
        ),
        hasMoreAfter: mtMap.objectField('has_more_after', mtMap.passthrough())
      })
    )
  });

export type ManagementOrganizationOutpostsCredentialsListQuery = {
  limit?: number | undefined;
  after?: string | undefined;
  before?: string | undefined;
  cursor?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
} & {};

export let mapManagementOrganizationOutpostsCredentialsListQuery = mtMap.union([
  mtMap.unionOption(
    'object',
    mtMap.object({
      limit: mtMap.objectField('limit', mtMap.passthrough()),
      after: mtMap.objectField('after', mtMap.passthrough()),
      before: mtMap.objectField('before', mtMap.passthrough()),
      cursor: mtMap.objectField('cursor', mtMap.passthrough()),
      order: mtMap.objectField('order', mtMap.passthrough())
    })
  )
]);

