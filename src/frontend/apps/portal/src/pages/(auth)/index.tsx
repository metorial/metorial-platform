import { renderWithLoader } from '@metorial/data-hooks';
import { ContentLayout } from '@metorial/layout/src/components/content';
import { PageHeader } from '@metorial/layout/src/components/header';
import { Button, Spacer } from '@metorial/ui';
import { SideBox } from '@metorial/ui-product';
import { Link } from 'react-router-dom';
import { MagicMcpSessionsTable } from '../../scenes/magicMcp/sessionsTable';
import { MagicMcpTokenSecret } from '../../scenes/magicMcp/tokensTable';
import { ServersGrid } from '../../scenes/servers/grid';
import { useConsumer } from '../../state/consumer/consumer';
import { useMagicMcpServers } from '../../state/consumer/magicMcpServer';
import { useMagicMcpTokens } from '../../state/consumer/magicMcpToken';
import { useFeaturedServerCollection } from '../../state/portal/client';
import { usePaths } from '../../state/portal/path';

export let HomePage = () => {
  let Paths = usePaths();
  let user = useConsumer();
  let collection = useFeaturedServerCollection();

  let deployments = useMagicMcpServers({
    limit: 1
  });
  let hasDeployments = !!deployments.data?.items.length;

  let apiKeys = useMagicMcpTokens();

  let secretApiKey = apiKeys.data?.items.find(a => a.status == 'active');

  return (
    <ContentLayout>
      <Spacer height={30} />

      {user.data && (
        <PageHeader
          title={`Welcome to Metorial, ${user.data?.name}!`}
          description="It's a good day to build something amazing."
        />
      )}

      {renderWithLoader({ apiKeys, deployments })(() => (
        <>
          {!hasDeployments && (
            <>
              <SideBox
                title="Welcome to Metorial!"
                description={
                  <>
                    Getting started is super easy. Let's begin by{' '}
                    <Link to={Paths.servers()}>deploying your first MCP server</Link>.
                  </>
                }
              >
                <Link to={Paths.servers()}>
                  <Button as="span" size="2">
                    Deploy Server
                  </Button>
                </Link>
              </SideBox>

              <Spacer height={25} />
            </>
          )}

          <div
            style={{
              display: 'grid',
              gap: 20,
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))'
            }}
          >
            <SideBox
              title="Integrate Metorial"
              description="Learn how to integrate Metorial with your AI app. We have guides for various programming languages and frameworks."
            >
              <Button
                size="2"
                onClick={() => {
                  window.open('https://metorial.com/docs', '_blank');
                }}
              >
                Read the Docs
              </Button>
            </SideBox>

            {secretApiKey && (
              <SideBox
                title="Connect to Metorial"
                description="Use this API key to connect to Metorial from your code."
              >
                <MagicMcpTokenSecret token={secretApiKey} />
              </SideBox>
            )}
          </div>

          <Spacer height={25} />

          <PageHeader
            title="Featured Servers"
            description="Explore some of the most popular servers in the Metorial community."
            size="5"
          />

          <ServersGrid orderByRank limit={6} collectionId={collection.data?.id} />

          <Spacer height={35} />

          <PageHeader
            title="Recent Sessions"
            description="Your recent sessions are listed below. Click on a session to view its details."
            size="5"
          />

          <MagicMcpSessionsTable limit={15} />
        </>
      ))}
    </ContentLayout>
  );
};
