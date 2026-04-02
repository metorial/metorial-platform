import { DashboardInstancePortalsAccessRequestsListQuery } from '@metorial/dashboard-sdk';
import { renderWithPagination, useForm } from '@metorial/data-hooks';
import {
  useCurrentInstance,
  usePortalAccessRequests,
  usePortalConsumerGroups,
  useReviewPortalAccessRequest
} from '@metorial/state';
import {
  Badge,
  Button,
  Dialog,
  Flex,
  Input,
  RenderDate,
  Select,
  Spacer,
  Text,
  showModal
} from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { useEffect } from 'react';
import { getPortalTargetLabel, getPortalTargetTypeLabel } from '../../pages/portal/shared';

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
        consumerGroupId: groupItems[0]?.id ?? '',
        resolutionMessage: ''
      },
      updateInitialValues: true,
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
      if (
        props.action != 'approved' ||
        form.values.consumerGroupId ||
        !groupItems[0]?.id
      ) {
        return;
      }

      form.setFieldValue('consumerGroupId', groupItems[0].id);
    }, [form, form.values.consumerGroupId, groupItems, props.action]);

    return (
      <Dialog.Wrapper {...dialogProps} width={560}>
        <Dialog.Title>
          {props.action == 'approved' ? 'Approve Request' : 'Reject Request'}
        </Dialog.Title>
        <Dialog.Description>
          Review the selected access request.
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

export let PortalAccessRequestsTable = (
  filter: DashboardInstancePortalsAccessRequestsListQuery & {
    portalId: string | undefined;
  }
) => {
  let instance = useCurrentInstance();
  let requests = usePortalAccessRequests(instance.data?.id, filter.portalId, filter);

  return renderWithPagination(requests, {
    hidePaginationWhenUnavailable: true
  })(requestsPage => (
    <>
      <Table
        headers={['Target', 'User', 'Message', 'Created', '']}
        data={requestsPage.data.items.map(request => ({
          data: [
            <Flex gap={3} direction="column">
              <Text size="2" weight="strong">
                {getPortalTargetLabel(request.target)}
              </Text>
              <Text size="1" color="gray600">
                {getPortalTargetTypeLabel(request.target)}
              </Text>
            </Flex>,
            <Flex gap={3} direction="column">
              <Text size="2" weight="strong">
                {request.consumerProfile.name}
              </Text>
              <Text size="1" color="gray600">
                {request.consumerProfile.email}
              </Text>
            </Flex>,
            request.message || 'No request message',
            <RenderDate date={request.createdAt} />,
            request.status == 'pending' ? (
              <Flex gap={5} justify="end" style={{ width: '100%' }}>
                <Button
                  size="1"
                  onClick={() =>
                    filter.portalId &&
                    showReviewAccessRequestModal({
                      instanceId: instance.data!.id,
                      portalId: filter.portalId,
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
                    filter.portalId &&
                    showReviewAccessRequestModal({
                      instanceId: instance.data!.id,
                      portalId: filter.portalId,
                      consumerAccessRequestId: request.id,
                      action: 'rejected',
                      onComplete: () => requests.refetch()
                    })
                  }
                >
                  Reject
                </Button>
              </Flex>
            ) : (
              <Flex direction="column" gap={2} align="end" style={{ width: '100%' }}>
                <Badge color={request.status == 'approved' ? 'green' : 'gray'}>
                  {request.status}
                </Badge>
                <Text size="1" color="gray600">
                  {request.resolutionMessage || 'Reviewed'}
                </Text>
              </Flex>
            )
          ]
        }))}
      />

      {requestsPage.data.items.length === 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No requests found for this portal.
        </Text>
      )}
    </>
  ));
};
