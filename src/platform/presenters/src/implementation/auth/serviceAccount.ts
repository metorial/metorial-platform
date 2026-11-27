import { v } from '@lowerdeck/validation';
import { getScopeDefinition, Scope } from '@metorial/module-access';
import { Presenter } from '@metorial/presenter';
import { serviceAccountType } from '../../types';
import { v1AccessPolicyPreviewPresenter } from '../accessControl/accessPolicyPreview';
import { v1OAuthApplicationClientSecretPresenter } from '../auth/oauthApplicationClientSecret';

export let v1ServiceAccountPresenter = Presenter.create(serviceAccountType)
  .presenter(async ({ serviceAccount }, opts) => ({
    object: 'machine_access.service_account',

    id: serviceAccount.id,
    status: serviceAccount.status,
    subject_type: serviceAccount.subjectType,

    name: serviceAccount.name,
    description: serviceAccount.description,

    scopes: serviceAccount.scopes.map(scope => {
      let definition = getScopeDefinition(scope as Scope);

      return {
        identifier: definition.identifier as string,
        name: definition.name,
        description: definition.description
      };
    }),

    client_id: serviceAccount.oauthApplication.clientId,

    policies: await Promise.all(
      (serviceAccount.policies ?? []).map(assignment =>
        v1AccessPolicyPreviewPresenter
          .present({ accessPolicy: assignment.accessPolicy }, opts)
          .run()
      )
    ),

    client_secrets: await Promise.all(
      (serviceAccount.oauthApplication.clientSecrets ?? []).map(clientSecret =>
        v1OAuthApplicationClientSecretPresenter
          .present({ oauthApplicationClientSecret: clientSecret }, opts)
          .run()
      )
    ),

    organization_id: serviceAccount.organization.id,
    portal_id: serviceAccount.portal?.id ?? null,
    consumer_profile_id: serviceAccount.consumerProfile?.id ?? null,

    created_at: serviceAccount.createdAt,
    updated_at: serviceAccount.updatedAt
  }))
  .schema(
    v.object({
      object: v.literal('machine_access.service_account', {
        description: "String representing the service account object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique identifier of the service account',
        examples: ['sac_7hNkPqRsTuVwXyZa']
      }),
      status: v.enumOf(['active', 'archived'], {
        name: 'status',
        description: 'Lifecycle status of the service account'
      }),
      subject_type: v.enumOf(['organization_member', 'consumer'], {
        name: 'subject_type',
        description:
          'Whether the service account acts as an organization member or as a dedicated portal consumer'
      }),
      name: v.string({
        name: 'name',
        description: 'Human-readable service account name',
        examples: ['CI Deploy Bot']
      }),
      description: v.nullable(
        v.string({
          name: 'description',
          description: 'Optional description of the service account'
        })
      ),
      scopes: v.array(
        v.object({
          identifier: v.string(),
          name: v.string(),
          description: v.string()
        })
      ),
      client_id: v.string({
        name: 'client_id',
        description: 'OAuth client identifier used by this service account'
      }),
      policies: v.array(v1AccessPolicyPreviewPresenter.schema, {
        name: 'policies',
        description: 'Access policies currently assigned to this service account'
      }),
      client_secrets: v.array(v1OAuthApplicationClientSecretPresenter.schema),
      organization_id: v.string({
        name: 'organization_id',
        description: 'Organization that owns this service account'
      }),
      portal_id: v.nullable(
        v.string({
          name: 'portal_id',
          description: 'Portal the service account acts on when the subject is a consumer',
          examples: ['ptl_7hNkPqRsTuVwXyZa']
        })
      ),
      consumer_profile_id: v.nullable(
        v.string({
          name: 'consumer_profile_id',
          description:
            'Dedicated consumer profile the service account acts as when the subject is a consumer',
          examples: ['cop_7hNkPqRsTuVwXyZa']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when this service account was created'
      }),
      updated_at: v.date({
        name: 'updated_at',
        description: 'Timestamp when this service account was last updated'
      })
    })
  )
  .build();
