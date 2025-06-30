package workers

import (
	"time"

	mcpPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/mcp"
	runnerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/runner"
	"github.com/metorial/metorial/mcp-broker/pkg/mcp"
)

type WorkerConnection interface {
	RemoteID() string
	ConnectionID() string

	AcceptMessage(message *mcp.MCPMessage) error
	GetServer() (*mcp.MCPServer, error)

	Start() error
	Close() error
	Done() <-chan struct{}

	Messages() <-chan mcp.MCPMessage
	Output() <-chan *mcpPb.McpOutput
	Errors() <-chan *mcpPb.McpError

	InactivityTimeout() time.Duration
}

type WorkerConnectionInput struct {
	RunConfig *runnerPb.RunConfig
	MCPClient *mcp.MCPClient

	ConnectionID string
	SessionID    string
}
