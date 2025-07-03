package workers

import (
	"time"

	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	runnerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/runner"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/pubsub"
)

type WorkerConnection interface {
	ConnectionID() string

	AcceptMessage(message *mcp.MCPMessage) error
	GetServer() (*mcp.MCPServer, error)

	Start() error
	Close() error

	Done() pubsub.BroadcasterReader[struct{}]
	Messages() pubsub.BroadcasterReader[*mcp.MCPMessage]
	Output() pubsub.BroadcasterReader[*mcpPb.McpOutput]
	Errors() pubsub.BroadcasterReader[*mcpPb.McpError]

	InactivityTimeout() time.Duration
}

type WorkerConnectionInput struct {
	RunConfig *runnerPb.RunConfig
	MCPClient *mcp.MCPClient

	ConnectionID string
	SessionID    string
}
