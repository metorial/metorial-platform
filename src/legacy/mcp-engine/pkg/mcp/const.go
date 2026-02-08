package mcp

type McpVersion string

var DEFAULT_MCP_VERSION = McpVersion("2024-11-05")

func (v McpVersion) String() string {
	return string(v)
}
