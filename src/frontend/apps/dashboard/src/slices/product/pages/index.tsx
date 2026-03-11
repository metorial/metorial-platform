import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import { ContentLayout, PageHeader } from '@metorial/layout';
import {
  useBoot,
  useCurrentInstance,
  useProviderDeployments,
  useRevealedApiKey,
  useUser
} from '@metorial/state';
import type { MetorialEnterpriseWindow } from '@metorial/state';
import { Button, Spacer, Text } from '@metorial/ui';
import { ID, SideBox } from '@metorial/ui-product';
import dedent from 'dedent';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiKeySecret } from '../scenes/apiKeys';
import { useApiKeysWithAutoInit } from '../scenes/apiKeys/useApiKeysWithAutoInit';
import {
  InstructionItem,
  Instructions
} from './(provider-api)/provider/components/instructions';
import { KeySelector } from './(provider-api)/provider/components/keySelector';
import { ProvidersGrid } from '../scenes/providers/grid_';

declare global {
  interface Window {
    metorial_enterprise?: MetorialEnterpriseWindow;
  }
}

export let ProjectHomePage = () => {
  let instance = useCurrentInstance();
  let user = useUser();

  let boot = useBoot();

  let deployments = useProviderDeployments(instance.data?.id);
  let hasDeployments = !!deployments.data?.items.length;
  let firstDeployment = deployments.data?.items[0];

  let apiKeys = useApiKeysWithAutoInit(
    instance.data
      ? {
          type: 'instance_access_token',
          instanceId: instance.data.id
        }
      : undefined
  );

  let pathItems = [
    instance.data?.organization,
    instance.data?.project,
    instance.data
  ] as const;

  let secretApiKey = apiKeys.data?.find(
    a =>
      a.type === 'instance_access_token_secret' &&
      a.status == 'active' &&
      (a.revealInfo?.forever || (a.revealInfo?.until && a.revealInfo?.until > new Date()))
  );

  let key = useRevealedApiKey({ apiKeyId: secretApiKey?.id });
  let [apiKeySecret, setApiKeySecret] = useState<string | undefined>(
    () => key.value ?? secretApiKey?.secret ?? undefined
  );
  useEffect(() => {
    if (key.value) setApiKeySecret(key.value);
  }, [key.value]);
  if (key.value) apiKeySecret = key.value;

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
          You can use the ID <ID id={firstDeployment.id} /> to reference this deployment in your
          code.
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
          Before you can use a provider, you need to deploy it. You can do this using the Metorial
          API or by clicking the button below.
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
    {
      title: 'Install the Metorial SDK',
      description: 'Get started by installing the Metorial SDK in your project.',
      variants: [
        {
          label: 'npm',
          item: {
            type: 'code' as const,
            code: `npm install --save ${['metorial', ...(d?.additionalPackages ?? [])].join(' ')}`
          }
        },
        {
          label: 'yarn',
          item: {
            type: 'code' as const,
            code: `yarn add ${['metorial', ...(d?.additionalPackages ?? [])].join(' ')}`
          }
        },
        {
          label: 'pnpm',
          item: {
            type: 'code' as const,
            code: `pnpm install --save ${['metorial', ...(d?.additionalPackages ?? [])].join(' ')}`
          }
        },
        {
          label: 'bun',
          item: {
            type: 'code' as const,
            code: `bun install ${['metorial', ...(d?.additionalPackages ?? [])].join(' ')}`
          }
        }
      ]
    },
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

  let getPythonStartInstructions = (d?: { additionalPackages?: string[] }): InstructionItem[] => [
    {
      title: 'Install the Metorial SDK',
      description: 'Get started by installing the Metorial SDK in your project.',
      variants: [
        {
          label: 'pip',
          item: {
            type: 'code' as const,
            code: `pip install ${['metorial', ...(d?.additionalPackages ?? [])].join(' ')}`
          }
        },
        {
          label: 'pipx',
          item: {
            type: 'code' as const,
            code: `pipx install ${['metorial', ...(d?.additionalPackages ?? [])].join(' ')}`
          }
        },
        {
          label: 'conda',
          item: {
            type: 'code' as const,
            code: `conda install -c conda-forge ${['metorial', ...(d?.additionalPackages ?? [])].join(' ')}`
          }
        },
        {
          label: 'uv',
          item: {
            type: 'code' as const,
            code: `uv add ${['metorial', ...(d?.additionalPackages ?? [])].join(' ')}`
          }
        }
      ]
    },
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
    if (apiKeys.isLoading || deployments.isLoading || key.isLoading) return undefined;

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

      {renderWithLoader({ instance, apiKeys, deployments })(() => (
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
                  path: 'examples/v2/typescript-ai-sdk',
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
                  path: 'examples/v2/typescript-openai',
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
                  path: 'examples/v2/typescript-openai',
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
