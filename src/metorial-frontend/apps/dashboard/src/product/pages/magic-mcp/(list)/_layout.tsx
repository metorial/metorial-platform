import { InitialLoadBoundary, PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { useCurrentInstance } from '@metorial/state';
import { Button } from '@metorial/ui';
import { Outlet } from 'react-router-dom';
import { showMagicMcpServerCreateFlow } from '../../../scenes/providerDeployments/magicMcpForm';

export let MagicMcpListLayout = () => {
  let instance = useCurrentInstance();
  return (
    <ContentLayout>
      <PageHeader
        title="Magic MCP"
        description="Deploy and configure MCP servers instantly. Connect them to Codex, Claude Cowork and more."
        actions={
          <Button
            onClick={() =>
              instance.data &&
              showMagicMcpServerCreateFlow({
                instanceId: instance.data.id
              })
            }
            size="2"
          >
            Create Magic MCP Server
          </Button>
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
