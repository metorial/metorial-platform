import { v } from '@lowerdeck/validation';
import { Presenter } from '@metorial/presenter';
import { sandboxLogLinesType } from '../../types';

export let v1SandboxLogLinesPresenter = Presenter.create(sandboxLogLinesType)
  .presenter(async ({ logs }) => ({
    object: 'sandbox.log_lines' as const,

    lines: logs.lines.map(line => ({
      index: line.index,
      source: line.source,
      timestamp: line.at,
      text: line.text
    })),

    next_cursor: logs.nextCursor as number | null,
    has_more: logs.hasMore,
    line_count: logs.lineCount,
    status: logs.status,
    truncated: logs.truncated
  }))
  .schema(
    v.object({
      object: v.literal('sandbox.log_lines', {
        description: "String representing the object's type"
      }),

      lines: v.array(
        v.object({
          index: v.number({ description: "The line's position in the log" }),
          source: v.enumOf(['system', 'stdout', 'stderr'], {
            description: 'Where the line was written'
          }),
          timestamp: v.date({ description: 'When the line was written' }),
          text: v.string({ description: 'The line' })
        }),
        { description: 'The requested lines' }
      ),
      next_cursor: v.nullable(
        v.number({ description: 'The cursor to pass to fetch the next page' })
      ),
      has_more: v.boolean({ description: 'Whether more lines are available' }),
      line_count: v.number({ description: 'The total number of lines written so far' }),
      status: v.enumOf(['open', 'sealed'], {
        description: 'Whether more lines can still be written'
      }),
      truncated: v.boolean({ description: 'Whether older lines were dropped to save space' })
    })
  )
  .build();
