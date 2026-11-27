import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxMachineExecResultType } from '../../types';

export let v1SandboxMachineExecResultPresenter = Presenter.create(sandboxMachineExecResultType)
  .presenter(async ({ result }) => ({
    object: 'sandbox.machine.exec_result' as const,

    exit_code: result.exitCode,
    signal: result.signal,
    timed_out: result.timedOut,

    stdout: result.stdout,
    stderr: result.stderr,
    stdout_truncated: result.stdoutTruncated,
    stderr_truncated: result.stderrTruncated
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.machine.exec_result', {
        description: "String representing the object's type"
      }),

      exit_code: v.nullable(
        v.number({
          description: 'The exit code of the command, or null if it was ended by a signal',
          examples: [0]
        })
      ),
      signal: v.nullable(
        v.string({
          description: 'The signal that ended the command, or null if it exited on its own',
          examples: ['KILL']
        })
      ),
      timed_out: v.boolean({
        description: 'Whether the command was stopped for running longer than its timeout'
      }),

      stdout: v.string({
        description: 'The standard output of the command, decoded as UTF-8',
        examples: ['hello\n']
      }),
      stderr: v.string({
        description: 'The standard error of the command, decoded as UTF-8',
        examples: ['']
      }),
      stdout_truncated: v.boolean({
        description: 'Whether stdout was cut off after its first 1 MiB'
      }),
      stderr_truncated: v.boolean({
        description: 'Whether stderr was cut off after its first 1 MiB'
      })
    })
  )
  .build();
