import { CodeBlock } from '@metorial/code';
import { renderWithLoader } from '@metorial/data-hooks';
import { Paths } from '@metorial/frontend-config';
import {
  useCurrentInstance,
  useProvider,
  useProviderDeployments,
  useProviderListingByProviderId
} from '@metorial/state';
import { Button, Spacer, Text } from '@metorial/ui';
import { ID, SideBox } from '@metorial/ui-product';
import dedent from 'dedent';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  createJavascriptSdkInstallInstruction,
  createPythonSdkInstallInstruction
} from '../../lib/instructionPresets';
import { useResolvedInstanceApiKeySecret } from '../../scenes/apiKeys/useResolvedInstanceApiKeySecret';
import { showProviderDeploymentFormModal } from '../../scenes/providerDeployments/modal';
import { useProviderVersionContext } from './_layout';
import { InstructionItem, Instructions } from './components/instructions';
import { KeySelector } from './components/keySelector';
import { Skills } from './components/skills';

export let ProviderOverviewPage = () => {
  let instance = useCurrentInstance();
  let navigate = useNavigate();
  let { selectedVersionId, selectedVersion, isDefaultVersion } = useProviderVersionContext();

  let { providerId } = useParams();
  let provider = useProvider(instance.data?.id, providerId);

  let listing = useProviderListingByProviderId(instance.data?.id, providerId);

  let { apiKeys, apiKeySecret, revealedApiKey, setApiKeySecret } =
    useResolvedInstanceApiKeySecret(instance.data?.id);

  let deployments = useProviderDeployments(
    instance.data?.id && providerId ? instance.data.id : null,
    {
      limit: 1,
      providerId,
      ...(!isDefaultVersion && selectedVersionId
        ? { providerVersionId: selectedVersionId }
        : {})
    }
  );
  let providerDeployment = deployments.data?.items[0];

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
            instance.data &&
            showProviderDeploymentFormModal({
              type: 'create',
              instanceId: instance.data.id,
              providerId: provider.data.id,
              providerName: provider.data.name,
              ...(!isDefaultVersion && selectedVersion
                ? {
                    lockedProviderVersionId: selectedVersion.id,
                    lockedProviderVersionLabel: selectedVersion?.version
                  }
                : {}),
              onCreate: deployment =>
                navigate(
                  Paths.instance.providerDeployment(
                    instance.data.organization,
                    instance.data.project,
                    instance.data,
                    deployment.id
                  )
                )
            })
          }
        >
          Deploy Provider
        </Button>
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
    if (apiKeys.isLoading || deployments.isLoading || revealedApiKey.isLoading)
      return undefined;

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

      {listing.data?.skills && listing.data.skills.length > 0 && (
        <>
          <Skills skills={listing.data.skills} />
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
