import { renderWithLoader, useForm } from '@metorial/data-hooks';
import {
  useCreateProviderSetupSessionEmails,
  useCurrentOrganization,
  useHasScope,
  useOrganizationMemberSearch,
  useProviderSetupSessionEmails
} from '@metorial/state';
import {
  Button,
  Combobox,
  Error,
  Flex,
  Input,
  InputDescription,
  InputLabel,
  OptionToggle,
  RenderDate,
  Spacer,
  Text,
  theme
} from '@metorial/ui';
import { useState } from 'react';
import styled from 'styled-components';

let recentEmailsLimit = 5;

type RecipientMode = 'email' | 'member';

let recipientModes: { id: RecipientMode; label: string }[] = [
  { id: 'email', label: 'Email Address' },
  { id: 'member', label: 'Organization Member' }
];

let sendByEmailDescription =
  'Email the link directly to the administrator who should approve the integration.';

let emptyRecipient = {
  email: '',
  organizationMemberId: '',
  organizationMemberName: ''
};

let EmailList = styled.div`
  display: flex;
  flex-direction: column;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
  overflow: hidden;
`;

let EmailRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;

  & + & {
    border-top: 1px solid ${theme.colors.gray400};
  }
`;

let RecipientField = styled.div`
  flex-grow: 1;
  min-width: 0;
`;

let RecentSetupEmails = (p: { instanceId: string; setupSessionId: string }) => {
  let recentEmails = useProviderSetupSessionEmails(p.instanceId, p.setupSessionId, {
    limit: recentEmailsLimit
  });

  return renderWithLoader(
    { recentEmails },
    {
      error: error => (
        <>
          <Spacer size={18} />
          <Error size={12}>{error.message ?? 'Failed to load recently sent emails.'}</Error>
        </>
      )
    }
  )(({ recentEmails }) => {
    if (!recentEmails.data.items.length) return null;

    return (
      <>
        <Spacer size={18} />

        <Text size="2" weight="strong">
          Recently Sent
        </Text>

        <Spacer size={8} />

        <EmailList>
          {recentEmails.data.items.map(email => (
            <EmailRow key={email.id}>
              <Text size="2">{email.recipientEmail ?? 'Organization member'}</Text>
              <Text size="1" color="gray600">
                {email.sender?.name ? `${email.sender.name}, ` : ''}
                <RenderDate date={email.createdAt} />
              </Text>
            </EmailRow>
          ))}
        </EmailList>
      </>
    );
  });
};

export let AdminSetupLinkEmailSection = (p: {
  instanceId: string;
  setupSessionId: string;
}) => {
  let organization = useCurrentOrganization();
  let memberAccess = useHasScope(organization.data?.id, 'organization.member:read');
  let sendEmails = useCreateProviderSetupSessionEmails();
  let [showSendResult, setShowSendResult] = useState(false);

  let form = useForm({
    initialValues: {
      ...emptyRecipient,
      mode: 'email' as RecipientMode
    },
    onSubmit: async (values, helpers) => {
      setShowSendResult(false);

      let [sent] = await sendEmails.mutate({
        instanceId: p.instanceId,
        setupSessionId: p.setupSessionId,
        ...(values.mode === 'email'
          ? { emails: [values.email.trim()] }
          : { organizationMemberIds: [values.organizationMemberId] })
      });
      if (!sent) return;

      helpers.resetForm({ values: { ...emptyRecipient, mode: values.mode } });
      setShowSendResult(true);
    },
    schema: yup =>
      yup.object({
        email: yup
          .string()
          .trim()
          .when('mode', {
            is: 'email',
            then: schema =>
              schema.email('Enter a valid email address').required('Email address is required')
          }),
        organizationMemberId: yup.string().when('mode', {
          is: 'member',
          then: schema => schema.required('Select an organization member')
        })
      })
  });

  let memberProvider = ({ searchQuery }: { searchQuery?: string }) => {
    let members = useOrganizationMemberSearch(organization.data?.id, searchQuery);

    return {
      items: (members.data?.items ?? []).map(member => ({
        id: member.id,
        label: member.actor.name,
        description: member.actor.email || 'Account email'
      })),
      isLoading: members.isLoading || !organization.data,
      empty: searchQuery ? 'No matching members found.' : 'No members available.'
    };
  };

  let changeMode = (mode: RecipientMode) => {
    setShowSendResult(false);
    form.setFieldValue('mode', mode, false);
    form.setTouched({}, false);
    form.setErrors({});
  };

  let isLastSendForMode =
    !!sendEmails.input && (sendEmails.input.emails ? 'email' : 'member') === form.values.mode;
  let lastSentEmail =
    showSendResult && !sendEmails.isLoading && !sendEmails.error
      ? sendEmails.data?.items[0]
      : undefined;
  let didSendNewEmail = !!sendEmails.data?.items.some(item => !item.deduplicated);

  return (
    <>
      <form onSubmit={form.handleSubmit} noValidate>
        {memberAccess.hasScope ? (
          <OptionToggle
            label="Send by Email"
            description={sendByEmailDescription}
            size="1"
            items={recipientModes}
            value={form.values.mode}
            disabled={sendEmails.isLoading}
            onChange={mode => changeMode(mode as RecipientMode)}
          />
        ) : (
          <>
            <InputLabel>Send by Email</InputLabel>
            <InputDescription style={{ marginBottom: 0 }}>
              {sendByEmailDescription}
            </InputDescription>
          </>
        )}

        <Spacer size={10} />

        <Flex gap={10} align="end">
          <RecipientField>
            {form.values.mode === 'email' ? (
              <Input
                label="Email Address"
                type="email"
                autoComplete="email"
                placeholder="admin@example.com"
                disabled={sendEmails.isLoading}
                {...form.getFieldProps('email')}
                onChange={e => {
                  setShowSendResult(false);
                  form.handleChange(e);
                }}
              />
            ) : (
              <Combobox
                label="Organization Member"
                placeholder="Search organization members"
                disabled={sendEmails.isLoading}
                value={form.values.organizationMemberId || null}
                valueLabel={form.values.organizationMemberName || undefined}
                provider={memberProvider}
                onChange={(value, item) => {
                  setShowSendResult(false);
                  form.setFieldValue('organizationMemberId', value ?? '');
                  form.setFieldValue('organizationMemberName', item?.label ?? '');
                }}
              />
            )}
          </RecipientField>

          <Button
            type="submit"
            loading={sendEmails.isLoading}
            success={sendEmails.isSuccess && didSendNewEmail}
          >
            Send Email
          </Button>
        </Flex>

        {form.values.mode === 'email' ? (
          <form.RenderError field="email" />
        ) : (
          <form.RenderError field="organizationMemberId" />
        )}

        {isLastSendForMode && <sendEmails.RenderError />}

        <div role="status" aria-live="polite">
          {lastSentEmail && (
            <>
              <Spacer size={6} />
              <Text size="1" color="gray600">
                {lastSentEmail.deduplicated
                  ? `Already emailed ${lastSentEmail.recipientEmail} recently — no new email was sent.`
                  : `Email to ${lastSentEmail.recipientEmail} queued for delivery.`}
              </Text>
            </>
          )}
        </div>
      </form>

      <RecentSetupEmails instanceId={p.instanceId} setupSessionId={p.setupSessionId} />
    </>
  );
};
