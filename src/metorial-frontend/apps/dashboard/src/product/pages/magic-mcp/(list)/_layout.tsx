import { InitialLoadBoundary, PaginationSearchParamsProvider } from '@metorial/data-hooks';
import { Explainer } from '@metorial/explainer';
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

      <Explainer
        title="Get started with Magic MCP"
        description="Instantly deploy and configure MCP servers. Connect them to Codex, Claude Cowork and more."
        videoUrl="https://dashboard-assets.metorial-cdn.com/videos/metorial-dashboard-onboarding/2026-07-13/magic-mcp-servers.mp4"
        id="magic-mcp-home"
      />
    </ContentLayout>
  );
};
