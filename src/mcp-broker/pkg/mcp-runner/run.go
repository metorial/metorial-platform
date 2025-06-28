package mcp_runner

import (
	"fmt"
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
		ID:        uuid.New().String(),
		StartTime: time.Now(),

		container: container,
		state:     state,
	}

	go run.monitor()

	return run, nil
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

func (m *Run) HandleOutput(messageHandler McpMessageHandler, outputHandler OutputHandler) {
	m.output(func(outputType OutputType, line string) {
		if outputType == OutputTypeStdout && strings.HasPrefix(line, "{") {
			message, err := mcp.ParseMCPMessage(line)
			if err != nil {
				messageHandler(message)
				return
			}
		}

		outputHandler(outputType, line)
	})
}

func (m *Run) HandleInput(input string) error {
	message, err := mcp.ParseMCPMessage(input)
	if err != nil {
		return fmt.Errorf("failed to parse MCP message")
	}
	return m.input(message.GetStringPayload())
}
