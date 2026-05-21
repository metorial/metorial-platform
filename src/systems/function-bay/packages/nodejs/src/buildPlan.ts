export type FunctionBayBuildSpec = {
  build?: boolean;
  scripts?: {
    build?: string;
  };
};

export type PackageJsonBuildSpec = {
  scripts?: {
    build?: string;
  };
};

export type BuildPlan =
  | { type: 'skip' }
  | { type: 'script'; command: string }
  | { type: 'package-script' }
  | { type: 'none' };

export let getBuildPlan = (
  functionBayFile: FunctionBayBuildSpec | null | undefined,
  packageJson: PackageJsonBuildSpec | null | undefined
): BuildPlan => {
  if (functionBayFile?.build === false) return { type: 'skip' };

  if (functionBayFile?.scripts?.build) {
    return {
      type: 'script',
      command: functionBayFile.scripts.build
    };
  }

  if (packageJson?.scripts?.build) return { type: 'package-script' };

  return { type: 'none' };
};
