import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import type { MetorialEnterpriseWindow } from '@metorial/state';
import { useCurrentInstance, useProviderDeployments, useUser } from '@metorial/state';
import { Button, Spacer, Text } from '@metorial/ui';
import { ID, SideBox } from '@metorial/ui-product';
import dedent from 'dedent';
import { Link } from 'react-router-dom';
import {
  createJavascriptSdkInstallInstruction,
  createPythonSdkInstallInstruction
} from '../lib/instructionPresets';
import { ApiKeySecret } from '../scenes/apiKeys';
import { useResolvedInstanceApiKeySecret } from '../scenes/apiKeys/useResolvedInstanceApiKeySecret';
import { ProvidersGrid } from '../scenes/providers/grid';
import { InstructionItem, Instructions } from './provider/components/instructions';
import { KeySelector } from './provider/components/keySelector';

declare global {
  interface Window {
    metorial_enterprise?: MetorialEnterpriseWindow;
  }
}

export let ProjectHomePage = () => {
  let instance = useCurrentInstance();
  let user = useUser();

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
          Before you can use a provider, you need to deploy it. You can do this using the
          Metorial API or by clicking the button below.
        </Text>

        <Spacer height={10} />

        <Link to={Paths.instance.providers(...pathItems)}>
          <Button as="span" size="2">
            Deploy Provider
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
          description="It's a good day to build something amazing."
        />
      )}

      {renderWithLoader({ instance, deployments })(() => (
        <>
          {!hasDeployments && (
            <>
              <SideBox
                title="Welcome to Metorial!"
                description={
                  <>
                    Getting started is super easy. Let's begin by{' '}
                    <Link to={Paths.instance.providers(...pathItems)}>
                      deploying your first MCP provider
                    </Link>
                    .
                  </>
                }
              >
                <Link to={Paths.instance.providers(...pathItems)}>
                  <Button as="span" size="2">
                    Deploy Provider
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

          <PageHeader
            title="Get Started"
            description="Integrate Metorial into your application in just a few steps."
            size="5"
          />

          <Spacer height={15} />

          <Instructions
            variants={[
              {
                title: 'JS & AI SDK',
                icon: (
                  <img
                    src="https://cdn.metorial.com/2025-06-09--10-17-03/logos/providers/vercel.svg"
                    alt="AI SDK"
                  />
                ),
                instructions: [
                  ...getJSStartInstructions({ additionalPackages: ['@metorial/ai-sdk'] })
                ],
                codeViewer: getCodeViewer({
                  repo: 'metorial-node',
                  path: 'examples/typescript-ai-sdk',
                  initialFile: 'index.ts'
                })
              },
              {
                title: 'JS & OpenAI',
                icon: (
                  <img
                    src="https://cdn.metorial.com/2025-06-09--10-17-03/logos/providers/openai.svg"
                    alt="OpenAI"
                  />
                ),
                instructions: [
                  ...getJSStartInstructions({ additionalPackages: ['@metorial/openai'] })
                ],
                codeViewer: getCodeViewer({
                  repo: 'metorial-node',
                  path: 'examples/typescript-openai',
                  initialFile: 'index.ts'
                })
              },
              {
                title: 'Node.js',
                icon: (
                  <img
                    src="https://cdn.metorial.com/2025-06-09--10-17-03/logos/languages/typescript.svg"
                    alt="TypeScript"
                  />
                ),
                instructions: [...getJSStartInstructions()],
                codeViewer: getCodeViewer({
                  repo: 'metorial-node',
                  path: 'examples/typescript-openai',
                  initialFile: 'index.ts'
                })
              },
              {
                title: 'Python',
                icon: (
                  <img
                    src="https://cdn.metorial.com/2025-06-09--10-17-03/logos/languages/python.svg"
                    alt="Python"
                  />
                ),
                instructions: [...getPythonStartInstructions()],
                codeViewer: getCodeViewer({
                  repo: 'metorial-python',
                  path: 'examples',
                  initialFile: 'python-openai.py'
                })
              }
            ]}
          />

          <Spacer height={35} />

          <PageHeader
            title="Featured Providers"
            description="Explore some of the most popular providers in the Metorial community."
            size="5"
          />

          <ProvidersGrid
            limit={6}
            providerCollectionId={window.metorial_enterprise?.landing_collection_ids}
          />
        </>
      ))}
    </ContentLayout>
  );
};
