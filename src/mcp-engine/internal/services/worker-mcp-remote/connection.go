package remote

import (
	"context"

	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	remotePb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
)

type MessageReceiver func(resp *remotePb.RunResponse)

type Connection interface {
	Close() error
	Context() context.Context
	Send(msg *mcpPb.McpMessageRaw) error
	Subscribe(cb MessageReceiver)
}
