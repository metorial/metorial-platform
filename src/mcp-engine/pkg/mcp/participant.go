package mcp

import (
	"encoding/json"
	"fmt"
	"time"

	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
)

type Capabilities map[string]any

type ParticipantInfo struct {
	Name    string         `json:"name"`
	Title   string         `json:"title"`
	Version string         `json:"version"`
	Extra   map[string]any `json:"-"`
}

type MCPClient struct {
	Info         ParticipantInfo `json:"clientInfo"`
	Capabilities Capabilities    `json:"capabilities"`
	Extra        map[string]any  `json:"-"`
}

type MCPServer struct {
	Info         ParticipantInfo `json:"serverInfo"`
	Capabilities Capabilities    `json:"capabilities"`
	Extra        map[string]any  `json:"-"`
}

func ParseMcpClient(data []byte) (*MCPClient, error) {
	var client MCPClient
	if err := json.Unmarshal(data, &client); err != nil {
		return nil, fmt.Errorf("failed to parse MCP client info: %w", err)
	}

	if client.Info.Name == "" {
		client.Info.Name = "MCP Client"
	}

	return &client, nil
}

func (c *MCPClient) Assemble() map[string]any {
	data := map[string]any{
		"clientInfo":   c.Info,
		"capabilities": c.Capabilities,
	}

	if len(c.Extra) > 0 {
		for k, v := range c.Extra {
			data[k] = v
		}
	}

	return data
}

func (c *MCPClient) ToInitMessage(version string) (*MCPMessage, error) {
	if version == "" {
		version = "2024-11-05"
	}

	inner := c.Assemble()
	inner["protocolVersion"] = version

	return NewMCPRequestMessage(fmt.Sprintf("mte/init/%d", time.Now().UnixMilli()), "initialize", inner)
}

func (s *MCPServer) Assemble() map[string]any {
	data := map[string]any{
		"serverInfo":   s.Info,
		"capabilities": s.Capabilities,
	}

	if len(s.Extra) > 0 {
		for k, v := range s.Extra {
			data[k] = v
		}
	}

	return data
}

func (s *MCPServer) ToPbParticipant() (*mcpPb.McpParticipant, error) {
	participantJson, err := json.Marshal(s.Assemble())
	if err != nil {
		return nil, fmt.Errorf("failed to marshal MCP server info: %w", err)
	}

	participant := &mcpPb.McpParticipant{
		Type:            mcpPb.McpParticipant_server,
		ParticipantJson: string(participantJson),
	}

	return participant, nil
}

func (s *MCPClient) ToPbParticipant() (*mcpPb.McpParticipant, error) {
	participantJson, err := json.Marshal(s.Assemble())
	if err != nil {
		return nil, fmt.Errorf("failed to marshal MCP client info: %w", err)
	}

	participant := &mcpPb.McpParticipant{
		Type:            mcpPb.McpParticipant_client,
		ParticipantJson: string(participantJson),
	}

	return participant, nil
}

type mcpResponseMessageWithServerInfo struct {
	Server MCPServer `json:"result"`
}

func ServerInfoFromMessage(message *MCPMessage) (*MCPServer, error) {
	if message == nil || message.MsgType != ResponseType {
		return nil, fmt.Errorf("invalid MCP message for server info")
	}

	var response mcpResponseMessageWithServerInfo
	if err := json.Unmarshal(message.GetRawPayload(), &response); err != nil {
		return nil, fmt.Errorf("failed to unmarshal server info from MCP message: %w", err)
	}

	return &response.Server, nil
}
