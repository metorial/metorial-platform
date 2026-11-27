import type { MetorialFileUploadProgress } from '@metorial/dashboard-sdk';
import { withAuth } from '../../user';

export let sandboxImageBuildContextPurpose = 'sandbox_image_build_context';

export let sandboxImageBuildContextMaxBytes = 50 * 1024 * 1024;

export let sandboxImageBuildContextExtensions = ['.zip', '.tar', '.tar.gz', '.tgz'];

export type SandboxImageBuildContextProblem = 'empty' | 'too_large' | 'unsupported_type';

export let validateSandboxImageBuildContext = (
  file: Pick<File, 'name' | 'size'>
): SandboxImageBuildContextProblem | null => {
  let name = file.name.toLowerCase();

  if (!sandboxImageBuildContextExtensions.some(extension => name.endsWith(extension))) {
    return 'unsupported_type';
  }

  if (file.size <= 0) return 'empty';
  if (file.size > sandboxImageBuildContextMaxBytes) return 'too_large';

  return null;
};

export let uploadSandboxImageBuildContext = (input: {
  instanceId: string;
  file: File | Blob;
  onProgress?: (progress: MetorialFileUploadProgress) => void;
  signal?: AbortSignal;
}) =>
  withAuth(sdk =>
    sdk.files.upload({
      instanceId: input.instanceId,
      file: input.file,
      purpose: sandboxImageBuildContextPurpose,
      onProgress: input.onProgress,
      signal: input.signal
    })
  );
