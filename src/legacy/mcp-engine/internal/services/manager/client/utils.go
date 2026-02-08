package client

import (
	"encoding/json"

	"github.com/mark3labs/mcp-go/mcp"
	ourMcp "github.com/metorial/metorial/mcp-engine/pkg/mcp"
)

func ServerInfoToMcpServer(serverInfo *mcp.InitializeResult) *ourMcp.MCPServer {
	if serverInfo == nil {
		return nil
	}

	capabilities := make(map[string]any)
	jsonStr, err := json.Marshal(serverInfo.Capabilities)
	if err != nil {
		return nil
	}

	if err := json.Unmarshal(jsonStr, &capabilities); err != nil {
		return nil
	}

	return &ourMcp.MCPServer{
		ProtocolVersion: serverInfo.ProtocolVersion,
		Capabilities:    capabilities,
		Info: ourMcp.ParticipantInfo{
			Name:    serverInfo.ServerInfo.Name,
			Version: serverInfo.ServerInfo.Version,
		},
	}
}
