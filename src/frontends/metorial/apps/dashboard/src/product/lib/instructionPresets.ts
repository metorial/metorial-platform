import { InstructionItem } from '../pages/provider/components/instructions';

let getPackageInstallVariants = (packages: string[]) => [
  {
    label: 'npm',
    item: {
      type: 'code' as const,
      code: `npm install --save ${packages.join(' ')}`
    }
  },
  {
    label: 'yarn',
    item: {
      type: 'code' as const,
      code: `yarn add ${packages.join(' ')}`
    }
  },
  {
    label: 'pnpm',
    item: {
      type: 'code' as const,
      code: `pnpm install --save ${packages.join(' ')}`
    }
  },
  {
    label: 'bun',
    item: {
      type: 'code' as const,
      code: `bun install ${packages.join(' ')}`
    }
  }
];

export let createJavascriptSdkInstallInstruction = (
  additionalPackages?: string[]
): InstructionItem => ({
  title: 'Install the Metorial SDK',
  description: 'Get started by installing the Metorial SDK in your project.',
  variants: getPackageInstallVariants(['metorial', ...(additionalPackages ?? [])])
});

export let createPythonSdkInstallInstruction = (
  additionalPackages?: string[]
): InstructionItem => ({
  title: 'Install the Metorial SDK',
  description: 'Get started by installing the Metorial SDK in your project.',
  variants: [
    {
      label: 'pip',
      item: {
        type: 'code' as const,
        code: `pip install ${['metorial', ...(additionalPackages ?? [])].join(' ')}`
      }
    },
    {
      label: 'pipx',
      item: {
        type: 'code' as const,
        code: `pipx install ${['metorial', ...(additionalPackages ?? [])].join(' ')}`
      }
    },
    {
      label: 'conda',
      item: {
        type: 'code' as const,
        code: `conda install -c conda-forge ${['metorial', ...(additionalPackages ?? [])].join(' ')}`
      }
    },
    {
      label: 'uv',
      item: {
        type: 'code' as const,
        code: `uv add ${['metorial', ...(additionalPackages ?? [])].join(' ')}`
      }
    }
  ]
});
