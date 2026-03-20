/**
 * Go mapper generator.
 *
 * Generates FromJSON/ToJSON helper functions for Go types.
 * In Go, encoding/json handles most serialization via struct tags,
 * so the mapper is intentionally minimal.
 *
 * NOTE: This does NOT include the package declaration or import block.
 * Those are added by the main generator when assembling the file.
 */

import type { IntrospectedType } from '../../fetch';
import { toGoIdentifier } from './utils';

/**
 * Generates Go mapper functions (FromJSON / ToJSON) for a given type.
 */
export let generateMapper = async (
  name: string,
  typename: string,
  type: IntrospectedType
): Promise<string> => {
  let goTypeName = toGoIdentifier(typename);
  let funcPrefix = toGoIdentifier(name);

  let code = '';

  code += `// ${funcPrefix}FromJSON deserializes JSON data into a ${goTypeName}.\n`;
  code += `func ${funcPrefix}FromJSON(data []byte) (*${goTypeName}, error) {\n`;
  code += `\tvar v ${goTypeName}\n`;
  code += `\tif err := json.Unmarshal(data, &v); err != nil {\n`;
  code += `\t\treturn nil, err\n`;
  code += `\t}\n`;
  code += `\treturn &v, nil\n`;
  code += `}\n`;

  code += `\n`;

  code += `// ${funcPrefix}ToJSON serializes a ${goTypeName} to JSON.\n`;
  code += `func ${funcPrefix}ToJSON(v *${goTypeName}) ([]byte, error) {\n`;
  code += `\treturn json.Marshal(v)\n`;
  code += `}\n`;

  return code + '\n';
};
