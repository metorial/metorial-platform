package remote_worker

import (
	"fmt"
	"time"

	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/pubsub"
)

type RemoteWorkerConnection struct {
	mcpServer *mcp.MCPServer
	mcpClient *mcp.MCPClient
	mcpConfig *mcpPb.McpConfig

	connectionID string
	sessionID    string

	run *Run
}

func (rw *RemoteWorker) CreateConnection(input *workers.WorkerConnectionInput) (workers.WorkerConnection, error) {
	if input.RemoteRunConfig == nil {
		return nil, fmt.Errorf("RemoteRunConfig is required to create a connection")
	}

	if rw.client == nil {
		return nil, fmt.Errorf("McpRemoteClient is not initialized for worker %s at %s", rw.WorkerID(), rw.Address())
	}

	run := NewRun(input.RemoteRunConfig, rw.client, input.ConnectionID)

	res := &RemoteWorkerConnection{
		run:       run,
		mcpClient: input.MCPClient,
		mcpConfig: input.McpConfig,

		connectionID: input.ConnectionID,
		sessionID:    input.SessionID,
	}

	return res, nil
}

func (rwc *RemoteWorkerConnection) Start(shouldAutoInit bool) error {

	if shouldAutoInit && rwc.mcpClient == nil {
		return fmt.Errorf("MCP client is not initialized, cannot auto-initialize")
	}

	if err := rwc.run.Start(); err != nil {
		return fmt.Errorf("failed to start MCP run: %w", err)
	}

	if shouldAutoInit {
		init, err := rwc.mcpClient.ToInitMessage(rwc.mcpConfig.McpVersion)
		if err != nil {
			return fmt.Errorf("failed to create MCP init message: %w", err)
		}

		serverInitMsg, err := rwc.SendAndWaitForResponse(init)
		if err != nil {
			return fmt.Errorf("failed to send MCP init message: %w", err)
		}

		mcpServer, err := mcp.ServerInfoFromMessage(serverInitMsg)
		if err != nil {
			return fmt.Errorf("failed to parse server info from MCP init message: %w", err)
		}

		rwc.mcpServer = mcpServer
	}

	return nil
}

func (rwc *RemoteWorkerConnection) Close() error {
	if err := rwc.run.Close(); err != nil {
		return fmt.Errorf("failed to close MCP run: %w", err)
	}

	return nil
}

func (rwc *RemoteWorkerConnection) Done() pubsub.BroadcasterReader[struct{}] {
	return rwc.run.Done()
}

func (rwc *RemoteWorkerConnection) ConnectionID() string {
	return rwc.connectionID
}

func (rwc *RemoteWorkerConnection) GetServer() (*mcp.MCPServer, error) {
	if rwc.mcpServer == nil {
		return nil, fmt.Errorf("MCP server not initialized")
	}
	return rwc.mcpServer, nil
}

func (rwc *RemoteWorkerConnection) AcceptMessage(message *mcp.MCPMessage) error {
	return rwc.run.SendMessage(message.ToPbRawMessage())
}

func (rws *RemoteWorkerConnection) SendAndWaitForResponse(message *mcp.MCPMessage) (*mcp.MCPMessage, error) {
	if message.MsgType != mcp.RequestType {
		return nil, fmt.Errorf("only request messages can be sent and waited for a response")
	}

	errchan := make(chan error, 1)
	defer close(errchan)

	msgchan := rws.run.messages.Subscribe()
	defer rws.run.messages.Unsubscribe(msgchan)

	donechan := rws.run.Done().Subscribe()
	defer rws.run.Done().Unsubscribe(donechan)

	go func() {
		if err := rws.AcceptMessage(message); err != nil {
			errchan <- fmt.Errorf("failed to send message: %w", err)
		}
	}()

	timeout := time.After(time.Second * 10)

	for {
		select {
		case <-donechan:
			return nil, fmt.Errorf("connection closed before receiving response")
		case err := <-errchan:
			return nil, err
		case <-timeout:
			return nil, fmt.Errorf("timeout waiting for response to message: %s", message.GetStringPayload())
		case msg := <-msgchan:
			if msg != nil {
				return msg, nil
			}
		}
	}
}

func (rwc *RemoteWorkerConnection) Messages() pubsub.BroadcasterReader[*mcp.MCPMessage] {
	if rwc.run == nil {
		return nil
	}

	return rwc.run.messages
}

func (rwc *RemoteWorkerConnection) Output() pubsub.BroadcasterReader[*mcpPb.McpOutput] {
	if rwc.run == nil {
		return nil
	}

	return rwc.run.output
}

func (rwc *RemoteWorkerConnection) Errors() pubsub.BroadcasterReader[*mcpPb.McpError] {
	if rwc.run == nil {
		return nil
	}

	return rwc.run.errors
}

func (rwc *RemoteWorkerConnection) InactivityTimeout() time.Duration {
	return time.Minute * 5
}

func (rwc *RemoteWorkerConnection) Clone() (workers.WorkerConnection, error) {
	res := &RemoteWorkerConnection{
		run:          rwc.run.Clone(),
		mcpClient:    rwc.mcpClient,
		mcpConfig:    rwc.mcpConfig,
		connectionID: rwc.connectionID,
		sessionID:    rwc.sessionID,
	}

	return res, nil
}
