import { v } from '@lowerdeck/validation';
import { sandboxBuildFailureCodes, sandboxFailureCodes } from '@metorial/module-sandbox';

export let sandboxFailureSchema = v.object({
  code: v.enumOf([...sandboxFailureCodes], {
    description: 'A stable, machine-readable code describing what failed'
  }),
  message: v.string({ description: 'A short, human-readable description of the failure' })
});

export let sandboxBuildFailureSchema = v.object({
  code: v.enumOf([...sandboxBuildFailureCodes], {
    description: 'A stable, machine-readable code describing why the build failed'
  }),
  message: v.string({ description: 'A short, human-readable description of the failure' })
});

export let sandboxReferenceSchema = (description: string) =>
  v.nullable(v.string({ description }));

export let toRawFailure = (failure: unknown) =>
  (failure ?? null) as { code: string; message: string } | null;

export let toNumber = (value: string | number | bigint) => Number(value);

export let toNullableNumber = (value: string | number | bigint | null | undefined) =>
  value === null || value === undefined ? null : Number(value);
