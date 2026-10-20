import { InitialLoadBoundary, PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import { Button } from '@metorial/ui';
import { Outlet, useNavigate } from 'react-router-dom';
import { showCreatePublicMcpServerDialog } from '../../../scenes/publicMcp/createDialog';

export let PublicMcpListLayout = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();

  return (
    <ContentLayout>
      <PageHeader
        title="Public MCP Servers"
        description="Publish an integration at a public URL. Any MCP client can connect, and each user signs in with their own account."
        actions={
          instance.data ? (
            <Button
              size="2"
              onClick={() =>
                showCreatePublicMcpServerDialog({
                  instanceId: instance.data!.id,
                  onCreate: server =>
                    navigate(
                      Paths.instance.publicMcp.server(
                        instance.data?.organization,
                        instance.data?.project,
                        instance.data,
                        server.id
                      )
                    )
                })
              }
            >
              Create Public MCP Server
            </Button>
          ) : undefined
        }
      />

      <InitialLoadBoundary>
        <PaginationSearchParamsProvider enabled={true}>
          <Outlet />
        </PaginationSearchParamsProvider>
      </InitialLoadBoundary>
    </ContentLayout>
  );
};
