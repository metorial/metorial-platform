import { describe, expect, it } from 'vitest';
import {
  toLifecycleHooksInput,
  toLifecyclePolicyInput,
  toMountsInput,
  toRuntimeInput
} from './_convert';

describe('sandbox request conversion', () => {
  it('converts the lifecycle policy to camel case', () => {
    expect(
      toLifecyclePolicyInput({
        pause_after_idle_seconds: 60,
        hibernate_after_paused_seconds: null
      })
    ).toEqual({
      pauseAfterIdleSeconds: 60,
      hibernateAfterPausedSeconds: null,
      connectionIdleSeconds: undefined
    });
  });

  it('leaves an omitted lifecycle policy omitted', () => {
    expect(toLifecyclePolicyInput(undefined)).toBeUndefined();
  });

  it('converts the runtime and keeps null to clear it', () => {
    expect(toRuntimeInput({ entrypoint: ['run'], stop_signal: 'SIGTERM' })).toMatchObject({
      entrypoint: ['run'],
      stopSignal: 'SIGTERM'
    });
    expect(toRuntimeInput(null)).toBeNull();
    expect(toRuntimeInput(undefined)).toBeUndefined();
  });

  it('converts hook timeouts', () => {
    expect(
      toLifecycleHooksInput([
        { type: 'http', on: 'start', port: 80, path: '/ready', timeout_seconds: 5 },
        { type: 'script', on: 'pause', path: '/hook.sh', arguments: ['a'] }
      ])
    ).toEqual([
      { type: 'http', on: 'start', port: 80, path: '/ready', timeoutSeconds: 5 },
      {
        type: 'script',
        on: 'pause',
        path: '/hook.sh',
        arguments: ['a'],
        timeoutSeconds: undefined
      }
    ]);
    expect(toLifecycleHooksInput(null)).toBeNull();
  });

  it('converts mounts', () => {
    expect(toMountsInput([{ disk_id: 'dsk_1', mount_path: '/data' }])).toEqual([
      { diskId: 'dsk_1', mountPath: '/data' }
    ]);
    expect(toMountsInput(undefined)).toBeUndefined();
  });
});
