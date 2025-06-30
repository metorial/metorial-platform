package workers

import (
	"fmt"
	"sync"
	"time"

	mcpPB "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/mcp"
	runnerPB "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/runner"
	"github.com/metorial/metorial/mcp-broker/pkg/mcp"
	mcp_runner_client "github.com/metorial/metorial/mcp-broker/pkg/mcp-runner-client"
)

type RunnerWorker struct {
	workerID string
	address  string

	acceptingRuns bool
	healthy       bool

	client  *mcp_runner_client.McpRunnerClient
	manager *WorkerManager

	mutex sync.Mutex
}

func NewRunnerWorker(workerID, address string) *RunnerWorker {
	return &RunnerWorker{
		workerID: workerID,
		address:  address,

		client: nil,
	}
}

func (rw *RunnerWorker) WorkerID() string {
	return rw.workerID
}

func (rw *RunnerWorker) Start() error {
	rw.mutex.Lock()
	defer rw.mutex.Unlock()

	if rw.client != nil {
		return nil // Already started
	}

	client, err := mcp_runner_client.NewMcpRunnerClient(rw.address)
	if err != nil {
		return err
	}

	rw.client = client

	go rw.monitor()
	rw.registerListeners()

	return nil
}

func (rw *RunnerWorker) Stop() error {
	rw.mutex.Lock()
	defer rw.mutex.Unlock()

	if rw.client == nil {
		return nil // Already stopped
	}

	if err := rw.client.Close(); err != nil {
		return err
	}

	rw.client = nil
	return nil
}

func (rw *RunnerWorker) AcceptingJobs() bool {
	return rw.acceptingRuns
}

func (rw *RunnerWorker) Healthy() bool {
	return rw.healthy
}

func (rw *RunnerWorker) Type() WorkerType {
	return WorkerTypeRunner
}

func (rw *RunnerWorker) monitor() {
	if rw.client == nil {
		return // Not started
	}

	rw.client.Wait()

	rw.mutex.Lock()
	defer rw.mutex.Unlock()

	rw.manager.removeWorker(rw.workerID)
}

func (rw *RunnerWorker) registerListeners() {
	go rw.client.StreamRunnerHealth(func(rhr *runnerPB.RunnerHealthResponse) {
		rw.mutex.Lock()
		defer rw.mutex.Unlock()

		rw.acceptingRuns = rhr.AcceptingRuns == runnerPB.RunnerAcceptingJobs_ACCEPTING
		rw.healthy = rhr.Status == runnerPB.RunnerStatus_HEALTHY
	})
}

type RunnerWorkerConnection struct {
	run       *mcp_runner_client.Run
	mcpServer *mcp.MCPServer
	mcpClient *mcp.MCPClient

	connectionID string
	sessionID    string

	messages chan mcp.MCPMessage
	output   chan *mcpPB.McpOutput
	errors   chan *mcpPB.McpError
}

func GetConnectionHashForRunnerWorker(input *WorkerConnectionInput) ([]byte, error) {
	if input.RunConfig == nil {
		return nil, fmt.Errorf("RunConfig is required to create a connection hash")
	}

	return []byte(input.RunConfig.Container.DockerImage), nil
}

func (rw *RunnerWorker) CreateConnection(input *WorkerConnectionInput) (WorkerConnection, error) {
	if input.RunConfig == nil {
		return nil, fmt.Errorf("RunConfig is required to create a connection")
	}

	run, err := rw.client.StreamMcpRun(input.RunConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create MCP run: %w", err)
	}

	res := &RunnerWorkerConnection{
		run:       run,
		mcpClient: input.MCPClient,

		connectionID: input.ConnectionID,
		sessionID:    input.SessionID,

		messages: make(chan mcp.MCPMessage, 10),
		output:   make(chan *mcpPB.McpOutput, 10),
		errors:   make(chan *mcpPB.McpError, 10),
	}

	go res.channelMapper()

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
	if rwc.run == nil {
		return nil // Already closed
	}

	if err := rwc.run.Close(); err != nil {
		return fmt.Errorf("failed to close MCP run: %w", err)
	}

	rwc.run = nil
	return nil
}

func (rwc *RunnerWorkerConnection) Done() <-chan struct{} {
	if rwc.run == nil {
		return nil // No run to wait for
	}

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

	if err := rws.AcceptMessage(message); err != nil {
		return nil, fmt.Errorf("failed to send message: %w", err)
	}

	for {
		select {
		case <-rws.Done():
			return nil, fmt.Errorf("connection closed before receiving response")
		case msg := <-rws.run.Messages():
			if msg != nil {
				parsed, _ := mcp.FromPbRawMessage(msg.Message)
				if parsed != nil && parsed.MsgType == mcp.ResponseType && parsed.GetStringId() == message.GetStringId() {
					return parsed, nil
				}
			}
		}
	}
}

func (rwc *RunnerWorkerConnection) Messages() <-chan mcp.MCPMessage {
	if rwc.run == nil {
		return nil
	}

	return rwc.messages
}

func (rwc *RunnerWorkerConnection) Output() <-chan *mcpPB.McpOutput {
	if rwc.run == nil {
		return nil
	}

	return rwc.output
}

func (rwc *RunnerWorkerConnection) Errors() <-chan *mcpPB.McpError {
	if rwc.run == nil {
		return nil
	}

	return rwc.errors
}

func (rwc *RunnerWorkerConnection) InactivityTimeout() time.Duration {
	return time.Second * 20
}

func (rwc *RunnerWorkerConnection) channelMapper() {
	defer close(rwc.messages)
	defer close(rwc.output)
	defer close(rwc.errors)

	if rwc.run == nil {
		return // No run to map channels
	}

	for {
		select {
		case <-rwc.run.Done():
			return // Exit if the run is done
		case msg := <-rwc.run.Messages():
			if msg != nil {
				parsed, _ := mcp.FromPbRawMessage(msg.Message)
				if parsed != nil {
					rwc.messages <- *parsed
				}
			}
		case output := <-rwc.run.Output():
			if output != nil {
				rwc.output <- output.McpOutput
			}
		case err := <-rwc.run.Errors():
			if err != nil {
				rwc.errors <- err.McpError
			}

		}
	}
}
