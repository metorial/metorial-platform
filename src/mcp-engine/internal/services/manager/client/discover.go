package client

import (
	"context"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/metorial/metorial/mcp-engine/internal/db"
)

func (c *Client) DiscoverTools() []mcp.Tool {
	if c.GetServerCapabilities().Tools == nil {
		return make([]mcp.Tool, 0)
	}

	res, err := c.Client.ListTools(context.Background(), mcp.ListToolsRequest{})
	if err != nil {
		return make([]mcp.Tool, 0)
	}

	return res.Tools
}

func (c *Client) DiscoverPrompts() []mcp.Prompt {
	if c.GetServerCapabilities().Prompts == nil {
		return make([]mcp.Prompt, 0)
	}

	res, err := c.Client.ListPrompts(context.Background(), mcp.ListPromptsRequest{})
	if err != nil {
		return make([]mcp.Prompt, 0)
	}

	return res.Prompts
}

func (c *Client) DiscoverResources() []mcp.Resource {
	if c.GetServerCapabilities().Resources == nil {
		return make([]mcp.Resource, 0)
	}

	res, err := c.Client.ListResources(context.Background(), mcp.ListResourcesRequest{})
	if err != nil {
		return make([]mcp.Resource, 0)
	}

	return res.Resources
}

func (c *Client) DiscoverResourceTemplates() []mcp.ResourceTemplate {
	if c.GetServerCapabilities().Resources == nil {
		return make([]mcp.ResourceTemplate, 0)
	}

	res, err := c.Client.ListResourceTemplates(context.Background(), mcp.ListResourceTemplatesRequest{})
	if err != nil {
		return make([]mcp.ResourceTemplate, 0)
	}

	return res.ResourceTemplates
}

func (c *Client) DiscoverServerAndApplyUpdates(server *db.Server) {
	if server == nil {
		return
	}

	server.McpServer = ServerInfoToMcpServer(c.serverInfo)

	server.Tools = c.DiscoverTools()
	server.Prompts = c.DiscoverPrompts()
	server.Resources = c.DiscoverResources()
	server.ResourceTemplates = c.DiscoverResourceTemplates()
}
