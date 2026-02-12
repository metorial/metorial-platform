import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useRevealedApiKey, useSessionTemplate } from '@metorial/state';
import { Attributes, Badge, Flex, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import dedent from 'dedent';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useApiKeysWithAutoInit } from '../../../scenes/apiKeys/useApiKeysWithAutoInit';
import { InstructionItem, Instructions } from '../provider/components/instructions';
import { KeySelector } from '../provider/components/keySelector';

export let SessionTemplateOverviewPage = () => {
  let instance = useCurrentInstance();

  let { sessionTemplateId } = useParams();
  let template = useSessionTemplate(instance.data?.instanceId, sessionTemplateId);

  let apiKeys = useApiKeysWithAutoInit(
    instance.data
      ? {
          type: 'instance_access_token',
          instanceId: instance.data.instanceId
        }
      : undefined
  );

  let secretApiKey = apiKeys.data?.find(
    (a: { type: string; status: string; revealInfo?: { forever?: boolean; until?: Date } }) =>
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

  return renderWithLoader({ template })(({ template }) => {
    let providers = template.data.providers ?? [];
    let templateId = template.data.id;

    let apiKeyReplacement = {
      __REPLACE_ME_WITH_API_KEY__: () => (
        <KeySelector
          name={`Template ${template.data.name} API Key`}
          onApiKey={setApiKeySecret}
        />
      )
    };

    let jsInstallStep = (additionalPackages?: string[]): InstructionItem => ({
      title: 'Install the Metorial SDK',
      description: 'Get started by installing the Metorial SDK in your project.',
      variants: [
        {
          label: 'npm',
          item: {
            type: 'code' as const,
            code: `npm install --save ${['metorial', ...(additionalPackages ?? [])].join(' ')}`
          }
        },
        {
          label: 'yarn',
          item: {
            type: 'code' as const,
            code: `yarn add ${['metorial', ...(additionalPackages ?? [])].join(' ')}`
          }
        },
        {
          label: 'pnpm',
          item: {
            type: 'code' as const,
            code: `pnpm install --save ${['metorial', ...(additionalPackages ?? [])].join(' ')}`
          }
        },
        {
          label: 'bun',
          item: {
            type: 'code' as const,
            code: `bun install ${['metorial', ...(additionalPackages ?? [])].join(' ')}`
          }
        }
      ]
    });

    let getJSInstructions = (d?: { additionalPackages?: string[] }): InstructionItem[] => [
      jsInstallStep(d?.additionalPackages),
      {
        title: 'Create a session from this template',
        description:
          'Use the template ID to create a session with all providers pre-configured.',
        type: 'code' as const,
        code: dedent`
          import { Metorial } from 'metorial';

          const metorial = new Metorial({
            apiKey: '${apiKeySecret ?? '__REPLACE_ME_WITH_API_KEY__'}',
          });

          const session = await metorial.sessions.create({
            sessionTemplateId: '${templateId}',
            name: 'My Session',
          });

          console.log(session.id);
        `,
        lineNumbers: true,
        replacements: apiKeyReplacement
      },
      {
        title: 'Use the session',
        description: 'Once created, use the session to interact with the configured providers.',
        type: 'code' as const,
        code: dedent`
          // List available tools in the session
          const tools = await session.listTools();

          // Call a tool
          const result = await session.callTool({
            name: tools[0].name,
            arguments: { /* tool arguments */ },
          });
        `,
        lineNumbers: true
      }
    ];

    let getPythonInstructions = (): InstructionItem[] => [
      {
        title: 'Install the Metorial SDK',
        description: 'Get started by installing the Metorial SDK in your project.',
        variants: [
          {
            label: 'pip',
            item: { type: 'code' as const, code: 'pip install metorial' }
          },
          {
            label: 'pipx',
            item: { type: 'code' as const, code: 'pipx install metorial' }
          },
          {
            label: 'conda',
            item: {
              type: 'code' as const,
              code: 'conda install -c conda-forge metorial'
            }
          },
          {
            label: 'uv',
            item: { type: 'code' as const, code: 'uv add metorial' }
          }
        ]
      },
      {
        title: 'Create a session from this template',
        description:
          'Use the template ID to create a session with all providers pre-configured.',
        type: 'code' as const,
        code: dedent`
          from metorial import Metorial

          metorial = Metorial(
              api_key='${apiKeySecret ?? '__REPLACE_ME_WITH_API_KEY__'}',
          )

          session = metorial.sessions.create(
              session_template_id='${templateId}',
              name='My Session',
          )

          print(session.id)
        `,
        lineNumbers: true,
        replacements: apiKeyReplacement
      },
      {
        title: 'Use the session',
        description: 'Once created, use the session to interact with the configured providers.',
        type: 'code' as const,
        code: dedent`
          # List available tools in the session
          tools = session.list_tools()

          # Call a tool
          result = session.call_tool(
              name=tools[0].name,
              arguments={},
          )
        `,
        lineNumbers: true
      }
    ];

    let getCodeViewer = (opts: { repo: string; path: string; initialFile?: string }) => {
      if (apiKeys.isLoading || key.isLoading) return undefined;

      return {
        owner: 'metorial',
        repo: opts.repo,
        path: opts.path,
        initialFile: opts.initialFile,
        replacements: {
          'your-metorial-api-key': apiKeySecret,
          'metorial-api-key': apiKeySecret,
          'your-session-template-id': templateId
        }
      };
    };

    return (
      <>
        <Attributes
          attributes={[
            {
              label: 'ID',
              content: <ID id={template.data.id} />
            },
            {
              label: 'Providers',
              content: `${providers.length} provider${providers.length !== 1 ? 's' : ''}`
            },
            {
              label: 'Created',
              content: <RenderDate date={template.data.createdAt!} />
            }
          ]}
        />

        <Spacer height={20} />

        {providers.length > 0 && (
          <>
            <Text size="3" weight="strong" style={{ display: 'block', marginBottom: 10 }}>
              Providers
            </Text>

            <Flex direction="column" gap={6}>
              {providers.map(
                (p: {
                  id: string;
                  provider?: { name: string } | null;
                  providerId: string;
                  providerDeployment?: { name: string } | null;
                  providerDeploymentId: string;
                  providerConfig?: { name: string } | null;
                  providerConfigId?: string | null;
                  providerAuthConfig?: { name: string } | null;
                  providerAuthConfigId?: string | null;
                }) => (
                  <div
                    key={p.id}
                    style={{
                      border: `1px solid ${theme.colors.gray300}`,
                      borderRadius: 8,
                      padding: '12px 16px'
                    }}
                  >
                    <Flex gap={8} style={{ alignItems: 'center' }}>
                      <Text size="2" weight="strong">
                        {p.provider?.name ?? p.providerId}
                      </Text>
                      <Badge color="gray" size="1">
                        {p.providerDeployment?.name ?? p.providerDeploymentId}
                      </Badge>
                    </Flex>

                    <Flex gap={12} style={{ marginTop: 6 }}>
                      <Text size="1" color="gray600">
                        Config: {p.providerConfig?.name ?? p.providerConfigId ?? 'None'}
                      </Text>
                      <Text size="1" color="gray600">
                        Auth: {p.providerAuthConfig?.name ?? p.providerAuthConfigId ?? 'None'}
                      </Text>
                    </Flex>
                  </div>
                )
              )}
            </Flex>

            <Spacer height={20} />
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
              instructions: getJSInstructions({ additionalPackages: ['@metorial/ai-sdk'] }),
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
              instructions: getJSInstructions({ additionalPackages: ['@metorial/openai'] }),
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
              instructions: getJSInstructions(),
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
              instructions: getPythonInstructions(),
              codeViewer: getCodeViewer({
                repo: 'metorial-python',
                path: 'examples',
                initialFile: 'python-openai.py'
              })
            }
          ]}
        />
      </>
    );
  });
};
