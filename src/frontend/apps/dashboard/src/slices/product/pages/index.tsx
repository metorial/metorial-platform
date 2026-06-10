import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  MetorialEnterpriseWindow,
  useCurrentInstance,
  useDashboardFlags,
  usePortals,
  useProviderDeployments,
  useUser
} from '@metorial/state';
import { Avatar, Button, Entity, Spacer, Text } from '@metorial/ui';
import { ID, SideBox } from '@metorial/ui-product';
import dedent from 'dedent';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import {
  createJavascriptSdkInstallInstruction,
  createPythonSdkInstallInstruction
} from '../lib/instructionPresets';
import { ApiKeySecret } from '../scenes/apiKeys';
import { useResolvedInstanceApiKeySecret } from '../scenes/apiKeys/useResolvedInstanceApiKeySecret';
import { HomeProvidersTable } from '../scenes/providers/homeTable';
import { InstructionItem } from './provider/components/instructions';
import { KeySelector } from './provider/components/keySelector';

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
  let instance = useCurrentInstance();
  let user = useUser();
  let flags = useDashboardFlags();
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

  let deployProvider: InstructionItem = {
    title: 'Deploy a Provider',
    description: 'Create a new deployment of a provider to start using it.',
    type: 'component' as const,
    component: firstDeployment ? (
      <>
        <Text>
          {firstDeployment.name
            ? `You already have a deployment called ${firstDeployment.name}. `
            : `You already have a deployment. `}
          You can use the ID <ID id={firstDeployment.id} /> to reference this deployment in
          your code.
        </Text>

        <Spacer height={10} />

        <CodeBlock
          code={JSON.stringify(
            {
              object: 'provider.deployment',
              id: firstDeployment.id,
              name: firstDeployment.name,
              createdAt: firstDeployment.createdAt,
              updatedAt: firstDeployment.updatedAt
            },
            null,
            2
          )}
        />
      </>
    ) : (
      <>
        <Text>
          Before you can use a provider, create a Magic MCP server or Integration from it. You
          can do this using the Metorial API or by clicking the button below.
        </Text>

        <Spacer height={10} />

        <Link to={Paths.instance.providers(...pathItems)}>
          <Button as="span" size="2">
            Use Provider
          </Button>
        </Link>
      </>
    )
  };

  let getJSStartInstructions = (d?: { additionalPackages?: string[] }): InstructionItem[] => [
    createJavascriptSdkInstallInstruction(d?.additionalPackages),
    {
      title: 'Instantiate the Metorial SDK',
      description: 'Set up the Metorial SDK with your API key.',
      type: 'code' as const,
      code: dedent`
        import { Metorial } from 'metorial';

        const metorial = new Metorial({
          apiKey: '${apiKeySecret ?? '__REPLACE_ME_WITH_API_KEY__'}',
        });
      `,
      lineNumbers: true,
      replacements: {
        __REPLACE_ME_WITH_API_KEY__: () => (
          <KeySelector name="Metorial API Key" onApiKey={setApiKeySecret} />
        )
      }
    },
    deployProvider
  ];

  let getPythonStartInstructions = (d?: {
    additionalPackages?: string[];
  }): InstructionItem[] => [
    createPythonSdkInstallInstruction(d?.additionalPackages),
    {
      title: 'Instantiate the Metorial SDK',
      description: 'Set up the Metorial SDK with your API key.',
      type: 'code' as const,
      code: dedent`
        from metorial import Metorial

        metorial = Metorial(
          api_key='${apiKeySecret ?? '__REPLACE_ME_WITH_API_KEY__'}',
        )
      `,
      lineNumbers: true,
      replacements: {
        __REPLACE_ME_WITH_API_KEY__: () => (
          <KeySelector name="Metorial API Key" onApiKey={setApiKeySecret} />
        )
      }
    },
    deployProvider
  ];

  let getCodeViewer = (opts: { repo: string; path: string; initialFile?: string }) => {
    if (apiKeys.isLoading || deployments.isLoading || revealedApiKey.isLoading)
      return undefined;

    return {
      owner: 'metorial',
      repo: opts.repo,
      path: opts.path,
      initialFile: opts.initialFile,
      replacements: {
        'your-server-deployment-id': firstDeployment?.id,
        'server-deployment-id': firstDeployment?.id,
        'your-normal-server-deployment-id': firstDeployment?.id,
        'your-oauth-server-deployment-id': firstDeployment?.id,
        'your-provider-deployment-id': firstDeployment?.id,
        'provider-deployment-id': firstDeployment?.id,
        'your-normal-provider-deployment-id': firstDeployment?.id,
        'your-oauth-provider-deployment-id': firstDeployment?.id,
        'your-metorial-api-key': apiKeySecret,
        'metorial-api-key': apiKeySecret
      }
    };
  };

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
