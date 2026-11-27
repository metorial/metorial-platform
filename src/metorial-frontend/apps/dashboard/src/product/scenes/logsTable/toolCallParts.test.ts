import { describe, expect, it } from 'vitest';
import { toolCallLinkQuery } from './toolCallParts';

describe('tool call parts', () => {
  it('links a tool call by connection, message and tool call', () => {
    expect(
      toolCallLinkQuery({ id: 'tcl_a', messageId: 'smg_a', connectionId: 'scn_a' })
    ).toEqual({ connection_id: 'scn_a', message_id: 'smg_a', tool_call_id: 'tcl_a' });

    let withoutConnection = toolCallLinkQuery({
      id: 'tcl_a',
      messageId: 'smg_a',
      connectionId: null
    });
    expect(withoutConnection).toEqual({ message_id: 'smg_a', tool_call_id: 'tcl_a' });
  });
});
