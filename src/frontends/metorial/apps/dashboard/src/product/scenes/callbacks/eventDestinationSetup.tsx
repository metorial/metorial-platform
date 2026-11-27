import { useForm } from '@metorial/data-hooks';
import { VerticalWizard } from '@metorial/layout';
import { useCreateEventDestination, useCreateEventDestinationListener } from '@metorial/state';
import {
  Button,
  Callout,
  Copy,
  Flex,
  Input,
  LargePanelDialog,
  showModal,
  Spacer,
  Text,
  Title,
  theme
} from '@metorial/ui';
import { useState } from 'react';
import styled from 'styled-components';
import {
  ListenerDraft,
  ListenerDraftEditor,
  createListenerDraft,
  getListenerScopeSummary,
  getUncreatedListenerDrafts,
  listenerDraftCanSubmit,
  listenerDraftToCreateBody
} from './listenerEditor';

let Header = styled.header`
  margin-bottom: 24px;
`;

let SummaryList = styled.div`
  overflow: hidden;
  border: 1px solid ${theme.colors.gray400};
  border-radius: 8px;
`;

let SummaryRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 14px;

  &:not(:last-child) {
    border-bottom: 1px solid ${theme.colors.gray300};
  }
`;

let listenerTypeLabel = (draft: ListenerDraft) => {
  if (draft.type === 'chat') return 'Chat Events';
  if (draft.type === 'system') return 'System Events';
  return 'Callback Triggers';
};

export let showEventDestinationSetupModal = (p: {
  organizationId: string;
  instanceId: string;
  onComplete: (destinationId: string) => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let createDestination = useCreateEventDestination();
    let createListener = useCreateEventDestinationListener();
    let [step, setStep] = useState<1 | 2>(1);
    let [draft, setDraft] = useState<ListenerDraft>(createListenerDraft());
    let drafts = [draft];
    let [createdDestination, setCreatedDestination] = useState<{
      id: string;
      signingSecret: string | null;
    } | null>(null);
    let [createdDraftIds, setCreatedDraftIds] = useState<Set<string>>(new Set());
    let [complete, setComplete] = useState(false);

    let isSubmitting = createDestination.isLoading || createListener.isLoading;
    let closeSetup = () => {
      if (isSubmitting || (createdDestination && !complete)) return;
      close();
    };
    let viewDestination = () => {
      close();
      if (createdDestination) p.onComplete(createdDestination.id);
    };

    let submit = async (values: { name: string; description: string; url: string }) => {
      let destination = createdDestination;

      if (!destination) {
        let [created] = await createDestination.mutate({
          organizationId: p.organizationId,
          name: values.name.trim(),
          description: values.description.trim() || undefined,
          type: 'webhook',
          webhook: { url: values.url.trim() }
        });
        if (!created) return;

        destination = {
          id: created.id,
          signingSecret: created.webhook?.signingSecret ?? null
        };
        setCreatedDestination(destination);
      }

      let completedIds = new Set(createdDraftIds);
      for (let draft of getUncreatedListenerDrafts(drafts, completedIds)) {
        let [created] = await createListener.mutate({
          organizationId: p.organizationId,
          ...listenerDraftToCreateBody(draft, p.instanceId, destination.id)
        });
        if (!created) {
          setCreatedDraftIds(completedIds);
          return;
        }

        completedIds.add(draft.id);
        setCreatedDraftIds(new Set(completedIds));
      }

      setComplete(true);
    };

    let form = useForm({
      initialValues: { name: '', description: '', url: '' },
      onSubmit: submit,
      schema: yup =>
        yup.object({
          name: yup.string().trim().required('Name is required'),
          description: yup.string(),
          url: yup
            .string()
            .trim()
            .url('Enter a valid HTTPS URL')
            .matches(/^https:\/\//i, 'Endpoint URL must use HTTPS')
            .required('Endpoint URL is required')
        })
    });

    let allDraftsValid = drafts.length > 0 && drafts.every(listenerDraftCanSubmit);
    let pendingDraftCount = getUncreatedListenerDrafts(drafts, createdDraftIds).length;

    return (
      <LargePanelDialog.Wrapper
        {...dialogProps}
        onOpenChange={isOpen => {
          if (!isOpen) closeSetup();
        }}
        closeButton={!isSubmitting && (!createdDestination || complete)}
      >
        <VerticalWizard
          steps={[
            {
              id: 'listeners',
              label: 'Choose Events',
              description: 'Configure listeners',
              state: step === 1 ? 'current' : 'completed',
              onClick: step === 2 && !createdDestination ? () => setStep(1) : undefined
            },
            {
              id: 'destination',
              label: 'Configure Destination',
              description: 'Add your endpoint',
              state: step === 2 ? 'current' : 'upcoming'
            }
          ]}
          footerStart={
            complete ? undefined : (
              <Button
                type="button"
                variant="outline"
                disabled={isSubmitting || !!createdDestination}
                onClick={step === 1 ? close : () => setStep(1)}
              >
                {step === 1 ? 'Cancel' : 'Back'}
              </Button>
            )
          }
          footer={
            complete ? (
              <Button type="button" onClick={viewDestination}>
                View Event Destination
              </Button>
            ) : step === 1 ? (
              <Button type="button" disabled={!allDraftsValid} onClick={() => setStep(2)}>
                Continue
              </Button>
            ) : (
              <Button
                type="submit"
                form="event-destination-setup-form"
                loading={isSubmitting}
                success={complete}
              >
                {createdDestination
                  ? `Retry ${pendingDraftCount === 1 ? 'Listener' : 'Listeners'}`
                  : 'Create Event Destination'}
              </Button>
            )
          }
        >
          {step === 1 ? (
            <>
              <Header>
                <Title size="5" weight="strong">
                  Choose Events
                </Title>
                <Spacer size={6} />
                <Text size="2" color="gray600">
                  Choose which events Metorial delivers to this destination.
                </Text>
              </Header>
              <ListenerDraftEditor
                organizationId={p.organizationId}
                instanceId={p.instanceId}
                value={draft}
                onChange={setDraft}
              />
            </>
          ) : complete ? (
            <>
              <Header>
                <Title size="5" weight="strong">
                  Destination Created
                </Title>
                <Spacer size={6} />
                <Text size="2" color="gray600">
                  Your endpoint and listener are ready.
                </Text>
              </Header>

              {createdDestination?.signingSecret ? (
                <>
                  <Callout color="orange">
                    <span>
                      <strong>Copy the signing secret now.</strong> It is shown once and cannot
                      be retrieved later.
                    </span>
                  </Callout>
                  <Spacer size={14} />
                  <Copy label="Signing Secret" value={createdDestination.signingSecret} />
                </>
              ) : (
                <Callout color="green">Event destination created successfully.</Callout>
              )}
            </>
          ) : (
            <>
              <Header>
                <Title size="5" weight="strong">
                  Configure Destination
                </Title>
                <Spacer size={6} />
                <Text size="2" color="gray600">
                  Enter the HTTPS endpoint that will receive the selected events.
                </Text>
              </Header>

              {createdDestination ? (
                <>
                  <Callout color="orange">
                    The destination was created. Retry to finish the remaining listener
                    {pendingDraftCount === 1 ? '' : 's'} before leaving setup.
                  </Callout>
                  <Spacer size={16} />
                </>
              ) : null}

              <form id="event-destination-setup-form" onSubmit={form.handleSubmit}>
                <Input
                  label="Endpoint URL"
                  required
                  disabled={!!createdDestination}
                  placeholder="https://example.com/metorial/webhooks"
                  {...form.getFieldProps('url')}
                />
                <form.RenderError field="url" />
                <Spacer size={12} />
                <Input
                  label="Name"
                  required
                  disabled={!!createdDestination}
                  {...form.getFieldProps('name')}
                />
                <form.RenderError field="name" />
                <Spacer size={12} />
                <Input
                  as="textarea"
                  minRows={3}
                  maxRows={8}
                  label="Description"
                  disabled={!!createdDestination}
                  {...form.getFieldProps('description')}
                />
                <form.RenderError field="description" />
                <Spacer size={20} />

                <Text size="2" weight="strong">
                  Listeners
                </Text>
                <Spacer size={8} />
                <SummaryList>
                  {drafts.map(draft => (
                    <SummaryRow key={draft.id}>
                      <Flex direction="column" gap={2}>
                        <Text size="2" weight="strong">
                          {listenerTypeLabel(draft)}
                        </Text>
                        <Text size="1" color="gray600">
                          {getListenerScopeSummary(draft)} · {draft.eventKeys.length} selected
                        </Text>
                      </Flex>
                      <Text size="1" color="gray600">
                        {createdDraftIds.has(draft.id) ? 'Created' : 'Selected'}
                      </Text>
                    </SummaryRow>
                  ))}
                </SummaryList>

                <createDestination.RenderError />
                <createListener.RenderError />
              </form>
            </>
          )}
        </VerticalWizard>
      </LargePanelDialog.Wrapper>
    );
  });
