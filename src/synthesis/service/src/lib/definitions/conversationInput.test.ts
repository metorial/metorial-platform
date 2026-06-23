import { v } from '@lowerdeck/validation';
import { describe, expect, it, vi } from 'vitest';
import { resolveAssistantConversationInput } from './conversationInput';

let context = {
  tenant: { id: 'tenant_1' },
  environment: { id: 'env_1' },
  actor: { id: 'actor_1' },
  assistant: { id: 'assistant_1' },
  assistantInstance: { id: 'assistant_instance_1' }
} as any;

describe('resolveAssistantConversationInput', () => {
  it('returns undefined when a no-input assistant receives no input', async () => {
    await expect(
      resolveAssistantConversationInput({
        ...context,
        assistantImplementation: {
          _persisted: { id: 'impl_1' }
        } as any,
        rawInput: undefined,
        rawInputProvided: false
      })
    ).resolves.toBeUndefined();
  });

  it('rejects provided input for a no-input assistant', async () => {
    await expect(
      resolveAssistantConversationInput({
        ...context,
        assistantImplementation: {
          _persisted: { id: 'impl_1' }
        } as any,
        rawInput: { project_id: 'project_1' },
        rawInputProvided: true
      })
    ).rejects.toThrow('This assistant does not accept conversation input.');
  });

  it('rejects invalid input before calling handleInput', async () => {
    let handleInput = vi.fn();

    await expect(
      resolveAssistantConversationInput({
        ...context,
        assistantImplementation: {
          _persisted: { id: 'impl_1' },
          input: v.object({
            project_id: v.string()
          }),
          handleInput
        } as any,
        rawInput: { project_id: 123 },
        rawInputProvided: true
      })
    ).rejects.toThrow();

    expect(handleInput).not.toHaveBeenCalled();
  });

  it('passes validated input to handleInput and returns the mapped value', async () => {
    let handleInput = vi.fn(async (d: { input: { project_id: string } }) => ({
      projectId: d.input.project_id
    }));

    await expect(
      resolveAssistantConversationInput({
        ...context,
        assistantImplementation: {
          _persisted: { id: 'impl_1' },
          input: v.object({
            project_id: v.string()
          }),
          handleInput
        } as any,
        rawInput: { project_id: 'project_1' },
        rawInputProvided: true
      })
    ).resolves.toEqual({
      projectId: 'project_1'
    });

    expect(handleInput).toHaveBeenCalledWith(
      expect.objectContaining({
        input: { project_id: 'project_1' },
        assistantImplementation: { id: 'impl_1' }
      })
    );
  });
});
