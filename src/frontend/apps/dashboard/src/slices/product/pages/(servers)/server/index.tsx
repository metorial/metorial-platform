import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useRevealedApiKey,
  useServer,
  useServerListing
} from '@metorial/state';
import { Button, Spacer } from '@metorial/ui';
import { SideBox } from '@metorial/ui-product';
import dedent from 'dedent';
import { Link, useParams } from 'react-router-dom';
import { useApiKeysWithAutoInit } from '../../../scenes/apiKeys/useApiKeysWithAutoInit';
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
                    apiKey: '${key.value ?? '__REPLACE_ME_WITH_API_KEY__'}',
                  });
                `,
      lineNumbers: true,
      replacements: {
        __REPLACE_ME_WITH_API_KEY__: () => (
          <KeySelector name={`Server ${server.data?.name} API Key`} />
        )
      }
    }
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
                     api_key='${key.value ?? '__REPLACE_ME_WITH_API_KEY__'}',
                   })
                  `,
      lineNumbers: true,
      replacements: {
        __REPLACE_ME_WITH_API_KEY__: () => (
          <KeySelector name={`Server ${server.data?.name} API Key`} />
        )
      }
    }
  ];

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
            codeViewer: {
              repo: 'mcp-containers',
              owner: 'metorial',
              path: 'scripts/add-server'
            }
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
            ]
          },
          {
            title: 'Node.js',
            icon: (
              <img
                src="https://cdn.metorial.com/2025-06-09--10-17-03/logos/languages/typescript.svg"
                alt="OpenAI Logo"
              />
            ),
            instructions: [...getJSStartInstructions()]
          },
          {
            title: 'Python',
            icon: (
              <img
                src="https://cdn.metorial.com/2025-06-09--10-17-03/logos/languages/python.svg"
                alt="OpenAI Logo"
              />
            ),
            instructions: [...getPythonStartInstructions()]
          }
        ]}
      />
    </>
  ));
};
