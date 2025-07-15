import { EngineSessionConnectionInternal } from './internal';
import { EngineSessionProxy } from './proxy';
import { EngineRunConfig } from './types';

export abstract class EngineSessionConnection {
  static async create(config: EngineRunConfig) {
    let inner = await EngineSessionConnectionInternal.ensure(config);
    if (!inner) return null;

    return new EngineSessionProxy(inner);
  }
}
