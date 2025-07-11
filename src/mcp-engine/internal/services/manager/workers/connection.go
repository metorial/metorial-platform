package workers

import (
	"time"

	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	remotePb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
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
	ContainerRunConfig *runnerPb.RunConfig
	RemoteRunConfig    *remotePb.RunConfig

	MCPClient *mcp.MCPClient
	McpConfig *mcpPb.McpConfig

	ConnectionID string
	SessionID    string
}
