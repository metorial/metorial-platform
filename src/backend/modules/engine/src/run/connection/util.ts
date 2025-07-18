import {
  EngineRunType,
  EngineSession,
  EngineSessionRun,
  EngineSessionType
} from '@metorial/mcp-engine-generated';

export let getEngineSessionType = (ses: EngineSession) =>
  ({
    [EngineSessionType.UNRECOGNIZED]: 'unknown' as const,
    [EngineSessionType.session_type_unknown]: 'unknown' as const,
    [EngineSessionType.session_type_container]: 'remote' as const,
    [EngineSessionType.session_type_remote]: 'container' as const
  })[ses.type] ?? 'unknown';

export let getEngineRunType = (ses: EngineSessionRun) =>
  ({
    [EngineRunType.UNRECOGNIZED]: 'unknown' as const,
    [EngineRunType.run_type_unknown]: 'unknown' as const,
    [EngineRunType.run_type_container]: 'remote' as const,
    [EngineRunType.run_type_remote]: 'container' as const
  })[ses.type] ?? 'unknown';
