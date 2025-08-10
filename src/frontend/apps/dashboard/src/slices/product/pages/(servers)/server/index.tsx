import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useRevealedApiKey,
  useServer,
  useServerDeployments,
  useServerListing
} from '@metorial/state';
import { Button, Spacer, Text } from '@metorial/ui';
import { ID, SideBox } from '@metorial/ui-product';
import dedent from 'dedent';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApiKeysWithAutoInit } from '../../../scenes/apiKeys/useApiKeysWithAutoInit';
import { showServerDeploymentFormModal } from '../../../scenes/serverDeployments/modal';
import { InstructionItem, Instructions } from './components/instructions';
import { KeySelector } from './components/keySelector';
import { Skills } from './components/skills';

export let ServerOverviewPage = () => {
  let instance = useCurrentInstance();

  let { serverId } = useParams();
  let server = useServer(instance.data?.id, serverId);

  let listing = useServerListing(serverId);

  let apiKeys = useApiKeysWithAutoInit(
    instance.data
      ? {
          type: 'instance_access_token',
          instanceId: instance.data.id
        }
      : undefined
  );

  let secretApiKey = apiKeys.data?.find(
    a =>
      a.type === 'instance_access_token_secret' &&
      ((a.status == 'active' && a.revealInfo?.forever) ||
        (a.revealInfo?.until && a.revealInfo?.until > new Date()))
  );

  let key = useRevealedApiKey({ apiKeyId: secretApiKey?.id });
  let [apiKeySecret, setApiKeySecret] = useState<string | undefined>(
    () => key.value ?? secretApiKey?.secret ?? undefined
  );
  useEffect(() => {
    if (key.value) setApiKeySecret(key.value);
  }, [key.value]);
  if (key.value) apiKeySecret = key.value;

  let deployments = useServerDeployments(instance.data?.id, {
    serverId: server.data?.id,
    limit: 1
  });
  let [serverDeployment, setServerDeployment] = useState(() => deployments.data?.items[0]);
  useEffect(() => {
    if (deployments.data?.items.length) {
      setServerDeployment(deployments.data.items[0]);
    }
  }, [deployments.data?.items]);

  let deployServer = {
    title: 'Deploy the Server',
    description: 'Create a new deployment of the server to start using it.',
    type: 'component' as const,
    component: serverDeployment ? (
      <>
        <Text>
          {serverDeployment.name
            ? `You already have a server deployment called ${serverDeployment.name} for this server. `
            : `You already have a server deployment for this server. `}
          You can use the ID <ID id={serverDeployment.id} /> to reference this deployment in
          your code.
        </Text>

        <Spacer height={10} />

        <CodeBlock
          code={JSON.stringify(
            {
              object: serverDeployment.object,
              id: serverDeployment.id,
              name: serverDeployment.name,
              description: serverDeployment.description,
              status: serverDeployment.status,
              createdAt: serverDeployment.createdAt,
              updatedAt: serverDeployment.updatedAt
            },
            null,
            2
          )}
        />
      </>
    ) : (
      <>
        <Text>
          Before you can use this server, you need to deploy it. You can do this using the
          Metorial API or by clicking the button below.
        </Text>

        <Spacer height={10} />

        <Button
          size="2"
          onClick={() =>
            server.data?.id &&
            showServerDeploymentFormModal({
              type: 'create',
              for: { serverId: server.data.id },
              onCreate: res => setServerDeployment(res)
            })
          }
        >
          Deploy Server
        </Button>
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
          <KeySelector
            name={`Server ${server.data?.name} API Key`}
            onApiKey={setApiKeySecret}
          />
        )
      }
    },

    deployServer
  ];

  let getPythonStartInstructions = (d?: {
    additionalPackages?: string[];
  }): InstructionItem[] => [
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
  
                   metorial = new Metorial({
                     api_key='${apiKeySecret ?? '__REPLACE_ME_WITH_API_KEY__'}',
                   })
                  `,
      lineNumbers: true,
      replacements: {
        __REPLACE_ME_WITH_API_KEY__: () => (
          <KeySelector
            name={`Server ${server.data?.name} API Key`}
            onApiKey={setApiKeySecret}
          />
        )
      }
    },

    deployServer
  ];

  let getCodeViewer = (opts: { repo: string; path: string; initialFile?: string }) => {
    if (apiKeys.isLoading || deployments.isLoading || key.isLoading) return undefined;

    return {
      owner: 'metorial',
      repo: opts.repo,
      path: opts.path,
      initialFile: opts.initialFile,
      replacements: {
        '...your-metorial-api-key...': apiKeySecret,
        '...metorial-api-key...': apiKeySecret,
        '...server-deployment-id...': serverDeployment?.id
      }
    };
  };

  return renderWithLoader({ server, listing })(({ server, listing }) => (
    <>
      {!!server.data?.variants.length && (
        <SideBox
          title="Test this server"
          description="Use the Metorial Explorer to test this server."
        >
          <Link
            to={Paths.instance.explorer(
              instance.data?.organization,
              instance.data?.project,
              instance.data,
              { server_id: server.data?.id }
            )}
          >
            <Button as="span" size="2">
              Open Explorer
            </Button>
          </Link>
        </SideBox>
      )}

      <Spacer height={15} />

      <Skills skills={listing.data.skills} />

      <Spacer height={15} />

      <Instructions
        variants={[
          {
            title: 'JS & AI SDK',
            icon: (
              <img
                src="https://cdn.metorial.com/2025-06-09--10-17-03/logos/providers/vercel.svg"
                alt="OpenAI Logo"
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
                alt="OpenAI Logo"
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
                alt="OpenAI Logo"
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
                alt="OpenAI Logo"
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
    </>
  ));
};
