"""
JSON Schema to OpenAPI Schema Conversion

Utilities for converting between different schema formats.
"""

from typing import Dict, Any, Optional


def json_schema_to_openapi(
  json_schema: Dict[str, Any], options: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
  """
  Convert a JSON Schema to an OpenAPI Schema.

  Args:
      json_schema: The JSON Schema to convert
      options: Conversion options including:
    - openapi_version: "3.0.0" or "3.1.0" (default: "3.0.0")
    - preserve_json_schema_keywords: bool (default: False)
    - null_handling: "nullable", "remove", or "preserve" (default: "nullable")

  Returns:
      OpenAPI Schema
  """
  if options is None:
    options = {}

  openapi_version = options.get("openapi_version", "3.0.0")
  null_handling = options.get("null_handling", "nullable")

  # Handle boolean schemas
  if isinstance(json_schema, bool):
    return {} if json_schema else {"not": {}}

  # Handle $ref
  if "$ref" in json_schema:
    return {"$ref": json_schema["$ref"]}

  result = {}

  # Handle composition keywords
  for composition_key in ["allOf", "anyOf", "oneOf"]:
    if composition_key in json_schema:
      result[composition_key] = [
        json_schema_to_openapi(schema, options)
        for schema in json_schema[composition_key]
      ]

  if "not" in json_schema:
    result["not"] = json_schema_to_openapi(json_schema["not"], options)

  # Handle type
  if "type" in json_schema:
    schema_type = json_schema["type"]

    if isinstance(schema_type, list):
      # JSON Schema allows array of types, OpenAPI doesn't
      types = [t for t in schema_type if t != "null"]
      has_null = "null" in schema_type

      if len(types) == 1:
        result["type"] = types[0]
        if has_null and null_handling == "nullable":
          result["nullable"] = True
      elif len(types) > 1:
        # Convert to anyOf
        result["anyOf"] = [{"type": t} for t in types]
        if has_null and null_handling == "nullable":
          result["nullable"] = True
    elif schema_type == "null":
      if null_handling == "nullable":
        result["nullable"] = True
      elif null_handling == "preserve":
        result["type"] = "null"
      # If null_handling == 'remove', we don't set type
    else:
      result["type"] = schema_type

  # Copy common properties
  common_props = [
    "title",
    "description",
    "default",
    "enum",
    "const",
    "readOnly",
    "writeOnly",
    "deprecated",
  ]

  for prop in common_props:
    if prop in json_schema:
      result[prop] = json_schema[prop]

  # Handle examples vs example
  if "examples" in json_schema and json_schema["examples"]:
    if openapi_version == "3.1.0":
      result["examples"] = json_schema["examples"]
    else:
      # OpenAPI 3.0 uses singular 'example'
      result["example"] = json_schema["examples"][0]

  # Type-specific properties
  if json_schema.get("type") == "string":
    string_props = ["minLength", "maxLength", "pattern", "format"]
    for prop in string_props:
      if prop in json_schema:
        result[prop] = json_schema[prop]

  elif json_schema.get("type") in ["number", "integer"]:
    number_props = [
      "minimum",
      "maximum",
      "exclusiveMinimum",
      "exclusiveMaximum",
      "multipleOf",
    ]
    for prop in number_props:
      if prop in json_schema:
        result[prop] = json_schema[prop]

  elif json_schema.get("type") == "array":
    array_props = ["minItems", "maxItems", "uniqueItems"]
    for prop in array_props:
      if prop in json_schema:
        result[prop] = json_schema[prop]

    if "items" in json_schema:
      result["items"] = json_schema_to_openapi(json_schema["items"], options)

  elif json_schema.get("type") == "object":
    object_props = ["minProperties", "maxProperties", "required"]
    for prop in object_props:
      if prop in json_schema:
        result[prop] = json_schema[prop]

    if "properties" in json_schema:
      result["properties"] = {
        key: json_schema_to_openapi(value, options)
        for key, value in json_schema["properties"].items()
      }

    if "additionalProperties" in json_schema:
      additional_props = json_schema["additionalProperties"]
      if isinstance(additional_props, bool):
        result["additionalProperties"] = additional_props
      else:
        result["additionalProperties"] = json_schema_to_openapi(
          additional_props, options
        )

  return result


def get_schema_format(
  tool_schema: Dict[str, Any], format_type: str = "json-schema"
) -> Dict[str, Any]:
  """
  Get tool schema in the specified format.

  Args:
      tool_schema: The original tool schema (assumed to be JSON Schema)
      format_type: Target format ('json-schema', 'openapi-3.0.0', 'openapi-3.1.0')

  Returns:
      Schema in the requested format
  """
  if format_type == "json-schema":
    return tool_schema

  if format_type in ["openapi-3.0.0", "openapi-3.1.0"]:
    return json_schema_to_openapi(
      tool_schema,
      {
        "openapi_version": format_type,
        "preserve_json_schema_keywords": False,
        "null_handling": "nullable",
      },
    )

  raise ValueError(f"Unknown schema format: {format_type}")
