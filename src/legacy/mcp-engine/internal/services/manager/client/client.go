package client

import (
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/client"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	ourMcp "github.com/metorial/metorial/mcp-engine/pkg/mcp"
)

type Client struct {
	*client.Client

	serverInfo *mcp.InitializeResult
}

func newMcpClient(connection workers.WorkerConnection) (*Client, error) {
	inner := client.NewClient(NewMetorialTransport(connection))

	return &Client{
		Client: inner,
	}, nil
}

func (c *Client) Start(ctx context.Context) error {
	err := c.Client.Start(ctx)
	if err != nil {
		return err
	}

	initRequest := mcp.InitializeRequest{}
	initRequest.Params.ProtocolVersion = ourMcp.DEFAULT_MCP_VERSION.String()
	initRequest.Params.ClientInfo = mcp.Implementation{
		Name:    "Metorial Auto Discovery (https://metorial.com)",
		Version: "1.0.0",
	}
	initRequest.Params.Capabilities = mcp.ClientCapabilities{}

	serverInfo, err := c.Client.Initialize(ctx, initRequest)

	if err != nil {
		c.Client.Close()
		return fmt.Errorf("failed to initialize MCP client: %w", err)
	}
	c.serverInfo = serverInfo

	return nil
}

func WithClient(connection workers.WorkerConnection, fn func(*Client) error) error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	mcpClient, err := newMcpClient(connection)
	if err != nil {
		return err
	}

	err = mcpClient.Start(ctx)
	if err != nil {
		return err
	}

	defer mcpClient.Close()

	return fn(mcpClient)
}
