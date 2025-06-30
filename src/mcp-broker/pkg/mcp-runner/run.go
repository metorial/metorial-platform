package mcp_runner

import (
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/metorial/metorial/mcp-broker/pkg/docker"
	"github.com/metorial/metorial/mcp-broker/pkg/mcp"
)

type Run struct {
	ID        string
	Init      *RunInit
	container *docker.ContainerHandle
	state     *RunnerState
	StartTime time.Time
	LastPing  time.Time
}

type RunInit struct {
	DockerImage        string
	ContainerEnv       map[string]string
	ContainerArgs      []string
	ContainerCommand   string
	ContainerMaxMemory string // Optional, e.g., "512m" or "1g"
	ContainerMaxCPU    string // Optional, e.g., "1" or "2"
}

type OutputType int

const (
	OutputTypeStdout OutputType = iota
	OutputTypeStderr
)

type OutputHandler func(outputType OutputType, line string)
type MultiOutputHandler func(outputType OutputType, line []string)

func newRun(state *RunnerState, init *RunInit) (*Run, error) {
	container, err := state.dockerManager.StartContainer(&docker.ContainerStartOptions{
		ImageRef:  init.DockerImage,
		Env:       init.ContainerEnv,
		Args:      init.ContainerArgs,
		Command:   init.ContainerCommand,
		MaxMemory: init.ContainerMaxMemory,
		MaxCPU:    init.ContainerMaxCPU,
	})
	if err != nil {
		return nil, err
	}

	run := &Run{
		Init:      init,
		ID:        uuid.NewString(),
		StartTime: time.Now(),
		LastPing:  time.Now(),

		container: container,
		state:     state,
	}

	go run.monitor()
	go run.pingRoutine()

	return run, nil
}

func (m *Run) pingRoutine() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if time.Since(m.LastPing) > 10*time.Second {
				// Container has not responded in a while, consider it dead
				m.Stop()
				return
			}

			// Send a ping message
			pingMessage := fmt.Sprintf(`{"jsonrpc": "2.0", "id": "mtr/ping/%d", "method": "ping"}`, time.Now().UnixMicro())
			if err := m.input(pingMessage + "\n"); err != nil {
				log.Printf("Failed to send ping: %v\n", err)
			}

		case <-m.container.Done():
			return
		}
	}
}

func (m *Run) monitor() {
	m.container.Wait()

	// Container has stopped, let's clean up
	m.state.removeRun(m.ID)
}

func (m *Run) Stop() error {
	if m.container == nil {
		return nil
	}
	return m.container.Stop()
}

func (m *Run) Wait() error {
	if m.container == nil {
		return nil
	}
	return m.container.Wait()
}

func (m *Run) input(line string) error {
	return m.container.WriteToStdin(line)
}

func (m *Run) output(handler OutputHandler) {
	m.container.ListenToStderr(func(line string) {
		handler(OutputTypeStderr, line)
	})

	m.container.ListenToStdout(func(line string) {
		handler(OutputTypeStdout, line)
	})
}

type McpMessageHandler func(message *mcp.MCPMessage)

func (m *Run) HandleOutput(messageHandler McpMessageHandler, outputHandler MultiOutputHandler) {
	stdoutBuffer := NewLineBuffer(100*time.Millisecond, func(line []string) {
		outputHandler(OutputTypeStdout, line)
	})

	stderrBuffer := NewLineBuffer(100*time.Millisecond, func(line []string) {
		outputHandler(OutputTypeStderr, line)
	})

	m.output(func(outputType OutputType, line string) {
		if outputType == OutputTypeStdout && strings.HasPrefix(line, "{") {
			message, err := mcp.ParseMCPMessage(line)

			if err == nil {
				stdoutBuffer.Flush()
				stderrBuffer.Flush()

				// We count any message as a ping. As long as the server is sending messages,
				// we consider it alive.
				m.LastPing = time.Now()

				// Handle ping requests
				if message.MsgType == mcp.RequestType && *message.Method == "ping" {
					resp, err := json.Marshal(map[string]interface{}{
						"jsonrpc": "2.0",
						"id":      message.GetRawId(),
						"result":  map[string]interface{}{},
					})
					if err != nil {
						log.Printf("Failed to marshal ping response: %v\n", err)
						return
					}

					err = m.input(string(resp) + "\n")
					return
				}

				// Handle ping responses
				if message.MsgType == mcp.ResponseType && strings.HasPrefix(message.GetStringId(), "mtr/ping/") {
					// Ignore ping responses
					return
				}

				messageHandler(message)
				return
			}
		}

		if outputType == OutputTypeStdout {
			stdoutBuffer.AddLine(line)
		}
		if outputType == OutputTypeStderr {
			stderrBuffer.AddLine(line)
		}
	})
}

func (m *Run) HandleInput(input string) error {
	message, err := mcp.ParseMCPMessage(input)
	if err != nil {
		return fmt.Errorf("failed to parse MCP message")
	}
	return m.input(message.GetStringPayload() + "\n")
}
