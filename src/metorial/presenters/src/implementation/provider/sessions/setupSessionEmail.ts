import { v } from '@lowerdeck/validation';
import { SETUP_SESSION_EMAIL_THROTTLE_WINDOW_MINUTES } from '@metorial-subspace/module-auth/src/lib/setupSessionEmailLimits';
import { Presenter } from '@metorial/presenter';
import { providerSetupSessionEmailType } from '../../../types';

export let v1SetupSessionEmailPresenter = Presenter.create(providerSetupSessionEmailType)
  .presenter(async ({ setupSessionEmail, deduplicated, hideMemberRecipientEmail }) => ({
    object: 'provider.setup_session.email' as const,

    id: setupSessionEmail.id,
    deduplicated: deduplicated ?? false,

    setup_session_id: setupSessionEmail.setupSession.id,
    recipient_email:
      hideMemberRecipientEmail && setupSessionEmail.organizationMemberId
        ? null
        : setupSessionEmail.recipientEmail,
    organization_member_id: setupSessionEmail.organizationMemberId,

    created_at: setupSessionEmail.createdAt
  }))
  .schema(
    v.object({
      object: v.literal('provider.setup_session.email', {
        description: "String representing the object's type"
      }),
      id: v.string({
        name: 'id',
        description: 'Unique setup session email identifier',
        examples: ['pasem_6eFgHjKlMnPqRsTu']
      }),
      deduplicated: v.boolean({
        name: 'deduplicated',
        description: `True when this recipient was already emailed this setup link in the current fixed ${SETUP_SESSION_EMAIL_THROTTLE_WINDOW_MINUTES}-minute window, so no new email was queued and the earlier record is returned instead. Only set by the create endpoint; always false when listing.`
      }),
      setup_session_id: v.string({
        name: 'setup_session_id',
        description: 'ID of the setup session whose link was emailed',
        examples: ['pas_6eFgHjKlMnPqRsTu']
      }),
      recipient_email: v.nullable(
        v.string({
          name: 'recipient_email',
          description:
            'Email address the setup link was queued for delivery to, lowercased. Null when the email was addressed to an organization member and the caller lacks the `organization.member:read` scope; `organization_member_id` identifies the member instead.',
          examples: ['it-admin@example.com']
        })
      ),
      organization_member_id: v.nullable(
        v.string({
          name: 'organization_member_id',
          description:
            'ID of the organization member the email was addressed to, or null when it was addressed to a plain email address',
          examples: ['ome_3nOpRsTuVwXyZaBc']
        })
      ),
      created_at: v.date({
        name: 'created_at',
        description: 'Timestamp when the email was queued for delivery',
        examples: [new Date('2026-10-23T10:30:00Z')]
      })
    })
  )
  .build();

export let dashboardSetupSessionEmailPresenter = Presenter.create(
  providerSetupSessionEmailType
)
  .presenter(async ({ setupSessionEmail, deduplicated, hideMemberRecipientEmail }, opts) => {
    let inner = await v1SetupSessionEmailPresenter
      .present({ setupSessionEmail, deduplicated, hideMemberRecipientEmail }, opts)
      .run();

    return {
      ...inner,

      sender: setupSessionEmail.senderActor
        ? {
            organization_actor_id: setupSessionEmail.senderActor.organizationActorId,
            name: setupSessionEmail.senderActor.name
          }
        : null
    };
  })
  .schema(
    v.intersection([
      v1SetupSessionEmailPresenter.schema,
      v.object({
        sender: v.nullable(
          v.object(
            {
              organization_actor_id: v.nullable(
                v.string({
                  name: 'organization_actor_id',
                  description: 'ID of the organization actor who requested the email',
                  examples: ['oac_1aBcDeFgHjKlMnPq']
                })
              ),
              name: v.string({
                name: 'name',
                description: 'Display name of the requester',
                examples: ['Jane Doe']
              })
            },
            {
              name: 'sender',
              description:
                'Who requested the email, or null when it was requested without an actor'
            }
          )
        )
      })
    ])
  )
  .build();
