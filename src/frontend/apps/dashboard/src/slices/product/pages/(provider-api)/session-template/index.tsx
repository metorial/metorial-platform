import { renderWithLoader } from '@metorial/data-hooks';
import { useCurrentInstance, useSessionTemplate } from '@metorial/state';
import { Attributes, RenderDate, Spacer, Text } from '@metorial/ui';
import { ID } from '@metorial/ui-product';
import dedent from 'dedent';
import { useParams } from 'react-router-dom';
import {
  createJavascriptSdkInstallInstruction,
  createPythonSdkInstallInstruction
} from '../../../lib/instructionPresets';
import { useResolvedInstanceApiKeySecret } from '../../../scenes/apiKeys/useResolvedInstanceApiKeySecret';
import { InstructionItem, Instructions } from '../provider/components/instructions';
import { KeySelector } from '../provider/components/keySelector';

export let SessionTemplateOverviewPage = () => {
  let instance = useCurrentInstance();

  let { sessionTemplateId } = useParams();
  let template = useSessionTemplate(instance.data?.id, sessionTemplateId);
  let { apiKeySecret, setApiKeySecret } = useResolvedInstanceApiKeySecret(instance.data?.id);

  return renderWithLoader({ template })(({ template }) => {
    let templateId = template.data.id;

    let apiKeyReplacement = {
      __REPLACE_ME_WITH_API_KEY__: () => (
        <KeySelector
          name={`Template ${template.data.name} API Key`}
          onApiKey={setApiKeySecret}
        />
      )
    };

    let getJSInstructions = (d?: { additionalPackages?: string[] }): InstructionItem[] => [
      createJavascriptSdkInstallInstruction(d?.additionalPackages),
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
      }
    ];

    let getPythonInstructions = (): InstructionItem[] => [
      createPythonSdkInstallInstruction(),
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
      }
    ];

    /*
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
    */

    return (
      <>
        <Attributes
          attributes={[
            {
              label: 'ID',
              content: <ID id={template.data.id} />
            },
            {
              label: 'Created',
              content: <RenderDate date={template.data.createdAt!} />
            }
          ]}
        />

        <Spacer height={20} />

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
              instructions: getJSInstructions({ additionalPackages: ['@metorial/ai-sdk'] })
              /*
              codeViewer: getCodeViewer({
                repo: 'metorial-node',
                path: 'examples/typescript-ai-sdk',
                initialFile: 'index.ts'
              })
              */
            },
            {
              title: 'JS & OpenAI',
              icon: (
                <img
                  src="https://cdn.metorial.com/2025-06-09--10-17-03/logos/providers/openai.svg"
                  alt="OpenAI"
                />
              ),
              instructions: getJSInstructions({ additionalPackages: ['@metorial/openai'] })
              /*
              codeViewer: getCodeViewer({
                repo: 'metorial-node',
                path: 'examples/typescript-openai',
                initialFile: 'index.ts'
              })
              */
            },
            {
              title: 'Node.js',
              icon: (
                <img
                  src="https://cdn.metorial.com/2025-06-09--10-17-03/logos/languages/typescript.svg"
                  alt="TypeScript"
                />
              ),
              instructions: getJSInstructions()
              /*
              codeViewer: getCodeViewer({
                repo: 'metorial-node',
                path: 'examples/typescript-openai',
                initialFile: 'index.ts'
              })
              */
            },
            {
              title: 'Python',
              icon: (
                <img
                  src="https://cdn.metorial.com/2025-06-09--10-17-03/logos/languages/python.svg"
                  alt="Python"
                />
              ),
              instructions: getPythonInstructions()
              /*
              codeViewer: getCodeViewer({
                repo: 'metorial-python',
                path: 'examples',
                initialFile: 'python-openai.py'
              })
              */
            }
          ]}
        />
      </>
    );
  });
};
