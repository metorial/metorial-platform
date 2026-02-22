import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useProvider,
  useProviderDeployments,
  useProviderListings,
  useRevealedApiKey
} from '@metorial/state';
import { Button, Spacer, Text } from '@metorial/ui';
import { ID, SideBox } from '@metorial/ui-product';
import dedent from 'dedent';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApiKeysWithAutoInit } from '../../../scenes/apiKeys/useApiKeysWithAutoInit';
import { showProviderDeploymentFormModal } from '../../../scenes/providerDeployments/modal';
import { useProviderVersionContext } from './_layout';
import { InstructionItem, Instructions } from './components/instructions';
import { KeySelector } from './components/keySelector';
import { Skills } from './components/skills';

export let ProviderOverviewPage = () => {
  let instance = useCurrentInstance();
  let { selectedVersionId, selectedVersion, isDefaultVersion } = useProviderVersionContext();

  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);

  // Fetch the listing for rich metadata (skills, readme, etc.)
  let listings = useProviderListings(
    providerId ? { limit: 100 } : null
  );
  let listing = (listings?.data?.items ?? []).find(
    item =>
      item.provider?.id === providerId &&
      (!selectedVersionId || item.provider?.currentVersion?.id === selectedVersionId)
  );

  let apiKeys = useApiKeysWithAutoInit(
    instance.data
      ? {
          type: 'instance_access_token',
          instanceId: instance.data.id
        }
      : undefined
  );

  let secretApiKey = apiKeys.data?.find(
    (a: {
      type: string;
      status: string;
      revealInfo?: { forever?: boolean; until?: Date } | null;
    }) =>
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

  let deployments = useProviderDeployments(instance.data?.id, {
    providerId: provider.data?.id,
    ...(!isDefaultVersion && selectedVersionId ? { providerVersionId: selectedVersionId } : {})
  });
  let [providerDeployment, setProviderDeployment] = useState(() => deployments.data?.items[0]);
  useEffect(() => {
    if (deployments.data?.items.length) {
      setProviderDeployment(deployments.data.items[0]);
    }
  }, [deployments.data?.items]);

  let deployProvider = {
    title: 'Deploy the Provider',
    description: 'Create a new deployment of the provider to start using it.',
    type: 'component' as const,
    component: providerDeployment ? (
      <>
        <Text>
          {providerDeployment.name
            ? `You already have a deployment called ${providerDeployment.name}. `
            : `You already have a deployment for this provider. `}
          You can use the ID <ID id={providerDeployment.id} /> to reference this deployment in
          your code.
        </Text>

        <Spacer height={10} />

        <CodeBlock
          code={JSON.stringify(
            {
              object: 'provider.deployment',
              id: providerDeployment.id,
              name: providerDeployment.name,
              createdAt: providerDeployment.createdAt,
              updatedAt: providerDeployment.updatedAt
            },
            null,
            2
          )}
        />
      </>
    ) : (
      <>
        <Text>
          Before you can use this provider, you need to deploy it. You can do this using the
          Metorial API or by clicking the button below.
        </Text>

        <Spacer height={10} />

        <Button
          size="2"
          onClick={() =>
            provider.data?.id &&
            showProviderDeploymentFormModal({
              type: 'create',
              providerId: provider.data.id,
              providerName: provider.data.name,
              ...(!isDefaultVersion && selectedVersion
                ? {
                    lockedProviderVersionId: selectedVersion.id,
                    lockedProviderVersionLabel: selectedVersion?.version
                  }
                : {})
            })
          }
        >
          Deploy Provider
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
            name={`Provider ${provider.data?.name} API Key`}
            onApiKey={setApiKeySecret}
          />
        )
      }
    },
    deployProvider
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

        metorial = Metorial(
          api_key='${apiKeySecret ?? '__REPLACE_ME_WITH_API_KEY__'}',
        )
      `,
      lineNumbers: true,
      replacements: {
        __REPLACE_ME_WITH_API_KEY__: () => (
          <KeySelector
            name={`Provider ${provider.data?.name} API Key`}
            onApiKey={setApiKeySecret}
          />
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
        // 'your-metorial-api-key': apiKeySecret,
        // 'metorial-api-key': apiKeySecret,

        'your-server-deployment-id': providerDeployment?.id,
        'server-deployment-id': providerDeployment?.id,
        'your-normal-server-deployment-id': providerDeployment?.id,
        'your-oauth-server-deployment-id': providerDeployment?.id,
        'your-metorial-api-key': apiKeySecret,
        'metorial-api-key': apiKeySecret
      }
    };
  };

  return renderWithLoader({ provider })(({ provider }) => (
    <>
      <SideBox
        title="Test this provider"
        description="Use the Metorial Explorer to test this provider."
      >
        <Link
          to={Paths.instance.explorer(
            instance.data?.organization,
            instance.data?.project,
            instance.data,
            { provider_id: provider.data?.id }
          )}
        >
          <Button as="span" size="2">
            Open Explorer
          </Button>
        </Link>
      </SideBox>

      <Spacer height={15} />

      {listing?.skills && listing.skills.length > 0 && (
        <>
          <Skills skills={listing.skills} />
          <Spacer height={15} />
        </>
      )}

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
    </>
  ));
};
