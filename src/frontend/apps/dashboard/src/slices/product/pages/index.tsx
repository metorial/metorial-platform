import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import { AssistantStartScene } from '@metorial/scene-assistant';
import {
  MetorialEnterpriseWindow,
  metorialAssistantSlug,
  useCurrentInstance,
  useDashboardFlags,
  usePortals,
  useProviderDeployments,
  useUser
} from '@metorial/state';
import { Avatar, Button, Entity, Spacer } from '@metorial/ui';
import { SideBox } from '@metorial/ui-product';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { ApiKeySecret } from '../scenes/apiKeys';
import { useResolvedInstanceApiKeySecret } from '../scenes/apiKeys/useResolvedInstanceApiKeySecret';
import { HomeProvidersTable } from '../scenes/providers/homeTable';

let WorkforceGrid = styled.div`
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 400px), 1fr));
`;

let WorkforceLink = styled(Link)`
  color: inherit;
  min-width: 0;
  text-decoration: none;

  & > div {
    min-width: 0;
  }
`;

declare global {
  interface Window {
    metorial_enterprise?: MetorialEnterpriseWindow;
  }
}

export let ProjectHomePage = () => {
  let navigate = useNavigate();
  let instance = useCurrentInstance();
  let user = useUser();
  let flags = useDashboardFlags();
  let assistantEnabled = flags.data?.flags['assistant-enabled'] === true;
  let portalsEnabled =
    flags.data?.flags['portals-access'] && flags.data?.flags['paid-portals'];

  let portals = usePortals(portalsEnabled ? instance.data?.id : null);

  let deployments = useProviderDeployments(instance.data?.id);
  let hasDeployments = !!deployments.data?.items.length;
  let firstDeployment = deployments.data?.items[0];

  let { apiKeys, apiKeySecret, secretApiKey, setApiKeySecret, revealedApiKey } =
    useResolvedInstanceApiKeySecret(instance.data?.id);

  let pathItems = [
    instance.data?.organization,
    instance.data?.project,
    instance.data
  ] as const;

  return (
    <ContentLayout>
      {user.data && (
        <PageHeader
          title={`Welcome to Metorial, ${user.data?.name}!`}
          description="It's a good day to build something amazing. Here are your resource at a glance."
        />
      )}

      {renderWithLoader({ instance, deployments })(() => (
        <>
          {assistantEnabled ? (
            <AssistantStartScene
              assistantSlug={metorialAssistantSlug}
              showHeader={false}
              fullWidth
              layout="embedded"
              onOpenConversation={(conversationId, state) =>
                navigate(
                  Paths.instance.assistantConversation(
                    instance.data!.organization,
                    instance.data!.project,
                    instance.data!,
                    conversationId
                  ),
                  { state }
                )
              }
            />
          ) : (
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
                    if (window.metorial_enterprise?.chrome?.showDocs) {
                      window.metorial_enterprise.chrome.showDocs();
                    } else {
                      window.open('https://metorial.com/docs', '_blank');
                    }
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
                  <ApiKeySecret apiKey={secretApiKey} />
                </SideBox>
              )}
            </div>
          )}

          <Spacer height={25} />

          {portalsEnabled && !!portals.data?.items.length && (
            <>
              <PageHeader
                title="Metorial Workforce"
                description="Give your team governed access to integrations on Metorial."
                size="5"
              />

              <WorkforceGrid>
                {portals.data?.items.map(p => (
                  <WorkforceLink to={Paths.instance.portal(...pathItems, p.id)} key={p.id}>
                    <Entity.Wrapper>
                      <Entity.Content>
                        <Entity.Field
                          title={p.name}
                          prefix={
                            <Avatar
                              entity={{
                                ...p,
                                imageUrl: `https://avatar-cdn.metorial.com/${p.id}`
                              }}
                              size={30}
                            />
                          }
                        />

                        <Entity.Field right title="Actions">
                          <Button size="2" as="span">
                            Manage Portal
                          </Button>
                        </Entity.Field>
                      </Entity.Content>
                    </Entity.Wrapper>
                  </WorkforceLink>
                ))}
              </WorkforceGrid>

              <Spacer height={25} />
            </>
          )}

          <PageHeader
            title="Integration Providers"
            description="Providers you have used recently or ones that are popular on Metorial."
            size="5"
            actions={
              <Link to={Paths.instance.providers(...pathItems)}>
                <Button size="2" as="span" variant="outline">
                  View All Providers
                </Button>
              </Link>
            }
          />

          <HomeProvidersTable limit={18} orderByUse="last_deployment_at" orderByRank />
        </>
      ))}
    </ContentLayout>
  );
};
