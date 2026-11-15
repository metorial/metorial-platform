import { functionBayLayer, type FunctionBayLayer } from '@function-bay/types';

export let readBuildLayer = (
  raw = process.env.METORIAL_FUNCTION_BAY_BUILD_LAYER
): FunctionBayLayer => {
  if (!raw) throw new Error('METORIAL_FUNCTION_BAY_BUILD_LAYER is not set');

  let result = functionBayLayer.validate(JSON.parse(raw));
  if (!result.success) {
    throw new Error(`Invalid build layer: ${JSON.stringify(result.errors, null, 2)}`);
  }

  return result.value;
};
