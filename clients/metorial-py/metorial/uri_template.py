"""
URI Template Processing for MCP Resources

Handles URI template expansion for Metorial MCP resource templates.
"""

import re
from typing import Dict, List, Union
from urllib.parse import quote


class McpUriTemplate:
  """URI template processor for MCP resource templates."""

  def __init__(self, template: str):
    self.template = template
    self.segments = self._parse_template(template)

  def _parse_template(
    self, template: str
  ) -> List[Union[str, Dict[str, Union[str, bool]]]]:
    """Parse URI template into segments."""
    pattern = r"\{(\/)?([\\w]+)(\*)?\}"
    matches = list(re.finditer(pattern, template))

    parts = []
    last_index = 0

    for match in matches:
      # Add literal text before the variable
      if match.start() > last_index:
        parts.append(template[last_index : match.start()])

      # Parse variable
      leading_slash, key, star = match.groups()
      parts.append(
        {"key": key, "explode": bool(star), "optional": bool(leading_slash)}
      )

      last_index = match.end()

    # Add remaining literal text
    if last_index < len(template):
      parts.append(template[last_index:])

    return parts

  def get_properties(self) -> List[Dict[str, Union[str, bool]]]:
    """Get all variable properties from the template."""
    return [part for part in self.segments if isinstance(part, dict)]

  def get_keys(self) -> List[str]:
    """Get all variable keys from the template."""
    return [prop["key"] for prop in self.get_properties()]

  def expand(self, values: Dict[str, Union[str, List[str]]]) -> str:
    """Expand the template with provided values."""
    result_parts = []

    for segment in self.segments:
      if isinstance(segment, str):
        result_parts.append(segment)
        continue

      key = segment["key"]
      explode = segment["explode"]
      optional = segment["optional"]

      value = values.get(key)

      if value is None:
        if optional:
          continue  # Skip optional parameters
        else:
          raise ValueError(f"Missing value for required key: {key}")

      # Format the value
      if isinstance(value, list):
        if explode:
          formatted = "/".join(quote(str(v), safe="") for v in value)
        else:
          formatted = quote(",".join(str(v) for v in value), safe="")
      else:
        formatted = quote(str(value), safe="")

      # Add optional leading slash
      if optional and formatted:
        result_parts.append("/")

      result_parts.append(formatted)

    return "".join(result_parts)


def slugify(input_str: str) -> str:
  """Convert a string to a URL-friendly slug."""
  import re

  result = input_str.lower().strip()
  result = re.sub(r"\s+", "-", result)  # Replace spaces with hyphens
  result = re.sub(r"[^a-z0-9_-]", "", result)  # Remove invalid characters
  result = re.sub(r"-+", "-", result)  # Replace multiple hyphens with single
  result = re.sub(r"^-+|-+$", "", result)  # Remove leading/trailing hyphens

  return result
