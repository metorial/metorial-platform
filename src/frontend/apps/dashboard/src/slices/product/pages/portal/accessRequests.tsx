import { renderWithLoader, renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  usePortalAccessRequests,
  usePortalConsumerGroups,
  useReviewPortalAccessRequest
} from '@metorial/state';
import {
  Button,
  Dialog,
  Entity,
  Input,
  Select,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import styled from 'styled-components';
import { getPortalTargetLabel, getPortalTargetTypeLabel } from './shared';

let RequestList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

let showReviewAccessRequestModal = (props: {
  instanceId: string;
  portalId: string;
  consumerAccessRequestId: string;
  action: 'approved' | 'rejected';
  onComplete: () => void;
}) =>
  showModal(({ dialogProps, close }) => {
    let reviewAccessRequest = useReviewPortalAccessRequest();
    let groups = usePortalConsumerGroups(props.instanceId, props.portalId, { limit: 100 });
    let groupItems = (groups.data?.items ?? []).map(group => ({
      id: group.id,
      label: group.name
    }));

    let form = useForm({
      initialValues: {
        consumerGroupId: '',
        resolutionMessage: ''
      },
      schema: yup =>
        yup.object({
          consumerGroupId:
            props.action == 'approved'
              ? yup.string().required('Choose a consumer group')
              : yup.string(),
          resolutionMessage: yup.string()
        }),
      onSubmit: async values => {
        let [updated] = await reviewAccessRequest.mutate({
          instanceId: props.instanceId,
          portalId: props.portalId,
          consumerAccessRequestId: props.consumerAccessRequestId,
          body: {
            status: props.action,
            resolutionMessage: values.resolutionMessage || undefined,
            consumerGroupId:
              props.action == 'approved' ? values.consumerGroupId : undefined
          }
        });

        if (!updated) return;

        props.onComplete();
        close();
      }
    });

    useEffect(() => {
      if (props.action != 'approved' || form.values.consumerGroupId || !groupItems[0]?.id) {
        return;
      }

      form.setFieldValue('consumerGroupId', groupItems[0].id);
    }, [form, groupItems, props.action]);

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>
          {props.action == 'approved' ? 'Approve Access Request' : 'Reject Access Request'}
        </Dialog.Title>
        <Dialog.Description>
          Review the selected portal access request.
        </Dialog.Description>

        <form onSubmit={form.handleSubmit}>
          {props.action == 'approved' && (
            <>
              <Select
                label="Consumer Group"
                value={form.values.consumerGroupId}
                items={groupItems}
                onChange={value => form.setFieldValue('consumerGroupId', value)}
              />
              <form.RenderError field="consumerGroupId" />
              <Spacer size={15} />
            </>
          )}

          <Input
            label="Resolution Message"
            {...form.getFieldProps('resolutionMessage')}
          />
          <form.RenderError field="resolutionMessage" />

          <Spacer size={20} />

          <Dialog.Actions>
            <Button type="button" variant="soft" onClick={close}>
              Cancel
            </Button>
            <Button
              type="submit"
              loading={reviewAccessRequest.isLoading}
              disabled={props.action == 'approved' && groupItems.length === 0}
            >
              {props.action == 'approved' ? 'Approve' : 'Reject'}
            </Button>
          </Dialog.Actions>
        </form>
      </Dialog.Wrapper>
    );
  });

export let PortalAccessRequestsPage = () => {
  let instance = useCurrentInstance();
  let { portalId } = useParams();
  let requests = usePortalAccessRequests(instance.data?.id, portalId);

  if (!portalId) return null;

  return renderWithLoader({ instance })(({ instance }) => (
    <>
      <Spacer size={15} />

      {renderWithPagination(requests, {
        hidePaginationWhenUnavailable: true
      })(requestsPage => (
        <RequestList>
          {requestsPage.data.items.map(request => (
            <Entity.Wrapper key={request.id}>
              <Entity.Content>
                <Entity.Field
                  title={`${request.consumerProfile.name} (${request.consumerProfile.email})`}
                  value={request.message ?? 'No request message'}
                />
                <Entity.Field
                  title="Target"
                  value={`${getPortalTargetLabel(request.target)} • ${getPortalTargetTypeLabel(
                    request.target
                  )}`}
                />
                <Entity.Field title="Status" value={request.status} />
                <Entity.Field
                  title="Actions"
                  right
                  value={
                    request.status == 'pending' ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Button
                          size="1"
                          onClick={() =>
                            showReviewAccessRequestModal({
                              instanceId: instance.data.id,
                              portalId,
                              consumerAccessRequestId: request.id,
                              action: 'approved',
                              onComplete: () => requests.refetch()
                            })
                          }
                        >
                          Approve
                        </Button>
                        <Button
                          size="1"
                          variant="outline"
                          onClick={() =>
                            showReviewAccessRequestModal({
                              instanceId: instance.data.id,
                              portalId,
                              consumerAccessRequestId: request.id,
                              action: 'rejected',
                              onComplete: () => requests.refetch()
                            })
                          }
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      request.resolutionMessage ?? 'Reviewed'
                    )
                  }
                />
              </Entity.Content>
            </Entity.Wrapper>
          ))}

          {requestsPage.data.items.length === 0 && (
            <Text size="2" color="gray600">
              No access requests have been submitted for this portal.
            </Text>
          )}
        </RequestList>
      ))}
    </>
  ));
};
