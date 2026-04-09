import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useCurrentOrganization,
  useCurrentProject,
  useProviderAuthConfig
} from '@metorial/state';
import { Attributes, Badge, RenderDate, Spacer, Text, theme } from '@metorial/ui';
import { Box } from '@metorial/ui-product';
import dedent from 'dedent';
import { Link, useParams } from 'react-router-dom';
import { styled } from 'styled-components';
import { createJavascriptSdkInstallInstruction } from '../../../lib/instructionPresets';
import { useResolvedInstanceApiKeySecret } from '../../../scenes/apiKeys/useResolvedInstanceApiKeySecret';
import { ProviderSessionsTable } from '../../../scenes/providerSessions/table';
import { UsageScene } from '../../../scenes/usage/usage';
import { InstructionItem, Instructions } from '../../provider/components/instructions';
import { KeySelector } from '../../provider/components/keySelector';
import { formatAuthConfigSource, formatAuthConfigType } from './helpers';

let VariantIcon = styled.div`
  width: 24px;
  height: 24px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: ${theme.colors.gray300};
  font-size: 12px;
  font-weight: 700;
`;

export let ProviderAuthConfigOverviewPage = () => {
  let instance = useCurrentInstance();
  let organization = useCurrentOrganization();
  let project = useCurrentProject();

  let { providerAuthConfigId } = useParams();
  let authConfig = useProviderAuthConfig(instance.data?.id, providerAuthConfigId);
  let { apiKeySecret, setApiKeySecret } = useResolvedInstanceApiKeySecret(instance.data?.id);

  return renderWithLoader({ authConfig })(({ authConfig }) => {
    let authMethodName =
      authConfig.data.authMethod?.name ?? authConfig.data.authMethod?.key ?? 'Unknown method';
    let deploymentTargetId = authConfig.data.deployment?.id;
    let deploymentTargetName = authConfig.data.deployment?.name ?? deploymentTargetId;
    let apiKeyReplacement = {
      __REPLACE_ME_WITH_API_KEY__: () => (
        <KeySelector
          name={`Auth Config ${authConfig.data.name ?? authConfig.data.id} API Key`}
          onApiKey={setApiKeySecret}
        />
      )
    };
    let nodeInstructions: InstructionItem[] = [
      {
        ...createJavascriptSdkInstallInstruction([
          '@metorial/ai-sdk',
          'ai',
          '@ai-sdk/anthropic'
        ]),
        description: 'Add the Metorial SDK and the packages used in this example.'
      },
      {
        title: 'Instantiate the Metorial SDK',
        description: 'Use an instance API key to create the Metorial client.',
        type: 'code' as const,
        code: dedent`
          import { Metorial } from 'metorial';

          let metorial = new Metorial({
            apiKey: '${apiKeySecret ?? '__REPLACE_ME_WITH_API_KEY__'}',
          });
        `,
        lineNumbers: true,
        replacements: apiKeyReplacement
      },
      {
        title: 'Use this auth config with a provider session',
        description:
          'Pass the deployment ID and auth config ID into withProviderSession(...) when you want tools available inside an AI workflow.',
        type: 'code' as const,
        code: dedent`
          import { anthropic } from '@ai-sdk/anthropic';
          import { metorialAiSdk } from '@metorial/ai-sdk';
          import { Metorial } from 'metorial';
          import { streamText, stepCountIs } from 'ai';

          let metorial = new Metorial({
            apiKey: '${apiKeySecret ?? '__REPLACE_ME_WITH_API_KEY__'}',
          });

          let providerAuthConfigId = '${authConfig.data.id}';

          let result = await metorial.withProviderSession(
            metorialAiSdk,
            {
              providers: [
                {
                  providerAuthConfigId
                }
              ],
              streaming: true
            },
            async ({ tools, closeSession }) => {
              let result = streamText({
                model: anthropic('claude-sonnet-4-20250514'),
                prompt: 'What are the top stories on Hacker News today?',
                stopWhen: stepCountIs(10),
                tools: tools,
                onFinish: async () => {
                  await closeSession();
                }
              });

              return result;
            }
          );

          for await (let part of result.textStream) {
            process.stdout.write(part);
          }
        `,
        lineNumbers: true,
        replacements: apiKeyReplacement
      },
      {
        title: 'Create a session directly',
        description:
          'Use sessions.create(...) when you want the simplest way to attach this auth config to a provider session.',
        type: 'code' as const,
        code: dedent`
          import { Metorial } from 'metorial';

          let metorial = new Metorial({
            apiKey: '${apiKeySecret ?? '__REPLACE_ME_WITH_API_KEY__'}',
          });

          let session = await metorial.sessions.create({
            name: 'My Provider Session',
            providers: [
              {
                providerAuthConfigId: '${authConfig.data.id}'
              }
            ]
          });

          console.log(session.id);
        `,
        lineNumbers: true,
        replacements: apiKeyReplacement
      }
    ];
    let pythonInstructions: InstructionItem[] = [
      {
        title: 'Install the Metorial SDK',
        description: 'Install the Python SDK.',
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
            item: { type: 'code' as const, code: 'conda install -c conda-forge metorial' }
          },
          {
            label: 'uv',
            item: { type: 'code' as const, code: 'uv add metorial' }
          }
        ]
      },
      {
        title: 'Instantiate the Metorial SDK',
        description: 'Use an instance API key to create the Metorial client.',
        type: 'code' as const,
        code: dedent`
          from metorial import Metorial

          metorial = Metorial(
              api_key='${apiKeySecret ?? '__REPLACE_ME_WITH_API_KEY__'}',
          )
        `,
        lineNumbers: true,
        replacements: apiKeyReplacement
      },
      {
        title: 'Create a session with this auth config',
        description: 'Pass the auth config ID directly into sessions.create(...).',
        type: 'code' as const,
        code: dedent`
          from metorial import Metorial

          metorial = Metorial(
              api_key='${apiKeySecret ?? '__REPLACE_ME_WITH_API_KEY__'}',
          )

          session = metorial.sessions.create(
              name='My Provider Session',
              providers=[
                  {
                      'provider_auth_config_id': '${authConfig.data.id}',
                  }
              ],
          )

          print(session.id)
        `,
        lineNumbers: true,
        replacements: apiKeyReplacement
      }
    ];
    let rawApiInstructions: InstructionItem[] = [
      {
        title: 'Create a session with this auth config',
        description:
          'Send the auth config ID in the providers array when creating a session through the HTTP API.',
        type: 'code' as const,
        language: 'bash',
        code: dedent`
          curl https://api.metorial.com/sessions \
            -X POST \
            -H "Authorization: Bearer ${apiKeySecret ?? '__REPLACE_ME_WITH_API_KEY__'}" \
            -H "Content-Type: application/json" \
            -d '{
              "name": "My Provider Session",
              "providers": [
                {
                  "provider_auth_config_id": "${authConfig.data.id}"
                }
              ]
            }'
        `,
        lineNumbers: false,
        replacements: apiKeyReplacement
      }
    ];

    return (
      <>
        <Attributes
          itemWidth="300px"
          attributes={[
            {
              label: 'Type',
              content: formatAuthConfigType(authConfig.data.type)
            },
            {
              label: 'Source',
              content: formatAuthConfigSource(authConfig.data.source)
            },
            {
              label: 'Status',
              content: (
                <Badge color={authConfig.data.status === 'active' ? 'green' : 'gray'}>
                  {authConfig.data.status}
                </Badge>
              )
            },
            {
              label: 'Deployment',
              content: deploymentTargetId ? (
                <Link
                  to={Paths.instance.providerDeployment(
                    organization.data,
                    project.data,
                    instance.data,
                    deploymentTargetId
                  )}
                >
                  {deploymentTargetName}
                </Link>
              ) : (
                <Text size="2" color="gray600">
                  N/A
                </Text>
              )
            },
            {
              label: 'Auth Method',
              content: authMethodName
            },
            {
              label: 'Updated At',
              content: <RenderDate date={authConfig.data.updatedAt} />
            }
          ]}
        />

        <Spacer height={15} />

        <Box
          title="Use this auth config"
          description="Pass this auth config by ID when creating or running provider sessions."
        >
          <Instructions
            variants={[
              {
                title: 'Node.js',
                icon: (
                  <img
                    src="https://cdn.metorial.com/2025-06-09--10-17-03/logos/languages/typescript.svg"
                    alt="TypeScript"
                  />
                ),
                instructions: nodeInstructions
              },
              {
                title: 'Python',
                icon: (
                  <img
                    src="https://cdn.metorial.com/2025-06-09--10-17-03/logos/languages/python.svg"
                    alt="Python"
                  />
                ),
                instructions: pythonInstructions
              },
              {
                title: 'Raw API',
                icon: <VariantIcon>{'</>'}</VariantIcon>,
                instructions: rawApiInstructions
              }
            ]}
          />
        </Box>

        <Spacer height={15} />

        <UsageScene
          title="Usage"
          description="See how this auth config is being used in your instance."
          entities={[{ type: 'provider_auth_config', id: authConfig.data.id }]}
          entityNames={{
            [authConfig.data.id]: authConfig.data.name ?? authConfig.data.id
          }}
        />

        <Spacer height={15} />

        <Box
          title="Recent Sessions"
          description="Latest sessions currently using this authentication configuration."
        >
          <ProviderSessionsTable providerAuthConfigId={authConfig.data.id} />
        </Box>

        {authConfig.data.metadata && Object.keys(authConfig.data.metadata).length > 0 ? (
          <>
            <Spacer height={15} />

            <Box
              title="Metadata"
              description="Additional metadata stored on this authentication configuration."
            >
              <CodeBlock
                code={JSON.stringify(authConfig.data.metadata, null, 2)}
                lineNumbers={false}
              />
            </Box>
          </>
        ) : null}
      </>
    );
  });
};
