package workers

import (
	"github.com/metorial/metorial/mcp-broker/pkg/mcp"
	pb "github.com/metorial/metorial/mcp-broker/pkg/proto-mcp-manager"
)

type WorkerConnection interface {
	RemoteID() string

	AcceptMessage(message *mcp.MCPMessage) error
	GetServer() (*mcp.MCPServer, error)

	Start() error
	Close() error
	Done() <-chan struct{}

	Messages() <-chan mcp.MCPMessage
	Output() <-chan *pb.McpOutput
	Errors() <-chan *pb.McpError
}
