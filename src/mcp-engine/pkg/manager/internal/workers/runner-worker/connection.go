package runner_worker

import (
	"fmt"
	"time"

	mcpPB "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/manager/internal/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/pubsub"
)

type RunnerWorkerConnection struct {
	mcpServer *mcp.MCPServer
	mcpClient *mcp.MCPClient

	connectionID string
	sessionID    string

	run *Run
}

func (rw *RunnerWorker) CreateConnection(input *workers.WorkerConnectionInput) (workers.WorkerConnection, error) {
	if input.RunConfig == nil {
		return nil, fmt.Errorf("RunConfig is required to create a connection")
	}

	if rw.client == nil {
		return nil, fmt.Errorf("McpRunnerClient is not initialized for worker %s at %s", rw.WorkerID(), rw.Address())
	}

	run := NewRun(input.RunConfig, rw.client)

	res := &RunnerWorkerConnection{
		run:       run,
		mcpClient: input.MCPClient,

		connectionID: input.ConnectionID,
		sessionID:    input.SessionID,
	}

	return res, nil
}

func (rwc *RunnerWorkerConnection) Start() error {
	if err := rwc.run.Start(); err != nil {
		return fmt.Errorf("failed to start MCP run: %w", err)
	}

	init, err := rwc.mcpClient.ToInitMessage()
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

	return nil
}

func (rwc *RunnerWorkerConnection) Close() error {
	if err := rwc.run.Close(); err != nil {
		return fmt.Errorf("failed to close MCP run: %w", err)
	}

	return nil
}

func (rwc *RunnerWorkerConnection) Done() <-chan struct{} {
	return rwc.run.Done()
}

func (rwc *RunnerWorkerConnection) RemoteID() string {
	return rwc.run.RemoteID
}

func (rwc *RunnerWorkerConnection) ConnectionID() string {
	return rwc.connectionID
}

func (rwc *RunnerWorkerConnection) GetServer() (*mcp.MCPServer, error) {
	if rwc.mcpServer == nil {
		return nil, fmt.Errorf("MCP server not initialized")
	}
	return rwc.mcpServer, nil
}

func (rwc *RunnerWorkerConnection) AcceptMessage(message *mcp.MCPMessage) error {
	return rwc.run.SendMessage(message.GetStringPayload())
}

func (rws *RunnerWorkerConnection) SendAndWaitForResponse(message *mcp.MCPMessage) (*mcp.MCPMessage, error) {
	if message.MsgType != mcp.RequestType {
		return nil, fmt.Errorf("only request messages can be sent and waited for a response")
	}

	errchan := make(chan error, 1)
	defer close(errchan)

	msgchan := rws.run.messages.Subscribe()
	defer rws.run.messages.Unsubscribe(msgchan)

	go func() {
		if err := rws.AcceptMessage(message); err != nil {
			errchan <- fmt.Errorf("failed to send message: %w", err)
		}
	}()

	for {
		select {
		case <-rws.Done():
			return nil, fmt.Errorf("connection closed before receiving response")
		case err := <-errchan:
			return nil, err
		case msg := <-msgchan:
			if msg != nil {
				return msg, nil
			}
		}
	}
}

func (rwc *RunnerWorkerConnection) Messages() *pubsub.Broadcaster[*mcp.MCPMessage] {
	if rwc.run == nil {
		return nil
	}

	return rwc.run.messages
}

func (rwc *RunnerWorkerConnection) Output() *pubsub.Broadcaster[*mcpPB.McpOutput] {
	if rwc.run == nil {
		return nil
	}

	return rwc.run.output
}

func (rwc *RunnerWorkerConnection) Errors() *pubsub.Broadcaster[*mcpPB.McpError] {
	if rwc.run == nil {
		return nil
	}

	return rwc.run.errors
}

func (rwc *RunnerWorkerConnection) InactivityTimeout() time.Duration {
	return time.Second * 20
}
