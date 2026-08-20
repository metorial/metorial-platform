// Vitest must transform these workspace sources instead of externalizing them through
// Node's ESM loader. Production resolves the workspace package normally.
export * from '../../../../../lowerdeck/packages/error/src/defaultErrors';
export * from '../../../../../lowerdeck/packages/error/src/error';
