package mcp

import (
	"encoding/json"

	"github.com/mark3labs/mcp-go/mcp"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
)

func getOptionalString(value string) *string {
	if value == "" {
		return nil
	}
	return &value
}

func TryMarshall(value any) string {
	data, err := json.Marshal(value)
	if err != nil {
		return "{}"
	}

	return string(data)
}

func ToolToPb(tool *mcp.Tool) *mcpPb.McpTool {
	if tool == nil {
		return nil
	}
	return &mcpPb.McpTool{
		Name:        tool.Name,
		Description: getOptionalString(tool.Description),
		Json:        TryMarshall(tool),
	}
}

func PromptToPb(prompt *mcp.Prompt) *mcpPb.McpPrompt {
	if prompt == nil {
		return nil
	}
	return &mcpPb.McpPrompt{
		Name:        prompt.Name,
		Description: getOptionalString(prompt.Description),
		Json:        TryMarshall(prompt),
	}
}

func ResourceToPb(resource *mcp.Resource) *mcpPb.McpResource {
	if resource == nil {
		return nil
	}
	return &mcpPb.McpResource{
		Name:        resource.Name,
		Description: getOptionalString(resource.Description),
		Json:        TryMarshall(resource),
	}
}

func ResourceTemplateToPb(resourceTemplate *mcp.ResourceTemplate) *mcpPb.McpResourceTemplate {
	if resourceTemplate == nil {
		return nil
	}
	return &mcpPb.McpResourceTemplate{
		Name:        resourceTemplate.Name,
		Description: getOptionalString(resourceTemplate.Description),
		Json:        TryMarshall(resourceTemplate),
	}
}
