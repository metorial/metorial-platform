import { DashboardInstancePortalsConsumerServerRequestsListQuery } from '@metorial/dashboard-sdk/src/gen/src/mt_2025_01_01_dashboard';
import { renderWithPagination } from '@metorial/data-hooks';
import { useCurrentInstance, usePortalServerRequests } from '@metorial/state';
import { Button, Flex, RenderDate, Text, toast } from '@metorial/ui';
import { Table } from '@metorial/ui-product';
import { createServerDeploymentTemplateForConsumerSurface } from './groupAccess';

export let PortalConsumerServerRequestsTable = (
  filter: DashboardInstancePortalsConsumerServerRequestsListQuery & {
    portalId: string | undefined;
  }
) => {
  let instance = useCurrentInstance();
  let requests = usePortalServerRequests(instance.data?.id, filter.portalId, filter);

  let accept = requests.acceptMutator();
  let reject = requests.rejectMutator();

  return renderWithPagination(requests)(requests => (
    <>
      <Table
        headers={['Server', 'User', 'Reason', 'Created', '']}
        data={requests.data.items.map(request => ({
          data: [
            request.server.name,
            request.consumer.name,
            request.reason,
            <RenderDate date={request.createdAt} />,
            <Flex gap={5} justify="end" style={{ width: '100%' }}>
              <Button
                size="1"
                variant="outline"
                disabled={request.status !== 'pending'}
                onClick={async () => {
                  createServerDeploymentTemplateForConsumerSurface({
                    instanceId: instance.data?.id!,
                    serverId: request.server.id,
                    addAccess: async template => {
                      let [res] = await accept.mutate({
                        consumerServerRequestId: request.id,
                        serverDeploymentTemplateId: template.id
                      });

                      toast.success(`Server request accepted. The user has been notified.`);

                      return !!res;
                    }
                  });
                }}
              >
                Accept
              </Button>
              <Button
                size="1"
                variant="outline"
                disabled={request.status !== 'pending'}
                onClick={async () => {
                  await reject.mutate({
                    consumerServerRequestId: request.id,
                    reason: 'Rejected by admin'
                  });
                }}
              >
                Reject
              </Button>
            </Flex>
          ]
        }))}
      />

      {requests.data.items.length == 0 && (
        <Text size="2" color="gray600" align="center" style={{ marginTop: 10 }}>
          No server requests found.
        </Text>
      )}
    </>
  ));
};
