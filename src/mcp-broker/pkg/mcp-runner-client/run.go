package mcp_runner_client

import (
	"context"
	"fmt"
	"log"
	"sync"

	mcpPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/mcp"
	runnerPb "github.com/metorial/metorial/mcp-broker/gen/mcp-broker/runner"
)

type Run struct {
	context context.Context
	close   context.CancelFunc

	RemoteID string
	Config   *runnerPb.RunConfig

	client runnerPb.McpRunnerClient
	stream runnerPb.McpRunner_StreamMcpRunClient

	createStreamWg sync.WaitGroup

	messages chan *runnerPb.RunResponseMcpMessage
	errors   chan *runnerPb.RunResponseError
	output   chan *runnerPb.RunResponseOutput

	initError error
}

func NewRun(config *runnerPb.RunConfig, client runnerPb.McpRunnerClient) *Run {
	ctx, cancel := context.WithCancel(context.Background())

	return &Run{
		context: ctx,
		close:   cancel,

		Config: config,

		client: client,

		messages: make(chan *runnerPb.RunResponseMcpMessage),
		errors:   make(chan *runnerPb.RunResponseError),
		output:   make(chan *runnerPb.RunResponseOutput),
	}
}

func (r *Run) Start() error {
	if r.client == nil {
		return fmt.Errorf("McpRunnerClient is not initialized")
	}

	if r.stream != nil {
		return fmt.Errorf("Run stream is already initialized")
	}

	r.createStreamWg.Add(1)

	go r.handleStream()

	r.createStreamWg.Wait()

	if r.initError != nil {
		return fmt.Errorf("failed to create MCP run stream: %w", r.initError)
	}

	return nil
}

func (r *Run) SendMessage(message string) error {
	r.createStreamWg.Wait()

	if r.stream == nil {
		return fmt.Errorf("Run stream is not initialized")
	}

	return r.stream.Send(&runnerPb.RunRequest{
		JobType: &runnerPb.RunRequest_McpMessage{
			McpMessage: &runnerPb.RunRequestMcpMessage{
				Message: &mcpPb.McpMessageRaw{
					Message: message,
				},
			},
		},
	})
}

func (r *Run) Close() error {
	r.createStreamWg.Wait()

	if r.stream == nil {
		return fmt.Errorf("Run stream is not initialized")
	}

	err := r.stream.Send(&runnerPb.RunRequest{
		JobType: &runnerPb.RunRequest_Close{
			Close: &runnerPb.RunRequestClose{},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to send close request: %w", err)
	}

	// Wait for the stream to close
	select {
	case <-r.context.Done():
	case <-r.stream.Context().Done():
	}

	r.stream = nil

	return nil
}

func (r *Run) Messages() <-chan *runnerPb.RunResponseMcpMessage {
	return r.messages
}

func (r *Run) Errors() <-chan *runnerPb.RunResponseError {
	return r.errors
}

func (r *Run) Output() <-chan *runnerPb.RunResponseOutput {
	return r.output
}

func (r *Run) Done() <-chan struct{} {
	if r.context == nil {
		return nil
	}

	return r.context.Done()
}

func (r *Run) Wait() {
	if r.context == nil {
		return
	}

	<-r.context.Done()
}

func (r *Run) handleStream() {
	defer r.close()
	defer close(r.messages)
	defer close(r.errors)
	defer close(r.output)

	stream, err := r.client.StreamMcpRun(context.Background())
	if err != nil {
		r.createStreamWg.Done()
		r.initError = fmt.Errorf("failed to create MCP run stream: %w", err)
		return
	}

	r.stream = stream
	defer stream.CloseSend()

	err = stream.Send(&runnerPb.RunRequest{
		JobType: &runnerPb.RunRequest_Init{
			Init: &runnerPb.RunRequestInit{
				RunConfig: r.Config,
			},
		},
	})
	if err != nil {
		r.createStreamWg.Done()
		r.initError = fmt.Errorf("failed to send initial request: %w", err)
		return
	}

	resp, err := stream.Recv()
	if err != nil {
		r.createStreamWg.Done()
		r.initError = fmt.Errorf("failed to receive initial response: %w", err)
		return
	}

	mcpErr := resp.GetError()
	if mcpErr != nil {
		r.createStreamWg.Done()
		r.errors <- mcpErr
		r.initError = fmt.Errorf("failed to start MCP run: %s", mcpErr.McpError.ErrorMessage)
		return
	}

	init := resp.GetInit()
	if init == nil {
		r.createStreamWg.Done()
		r.initError = fmt.Errorf("initial response is not an Init message")
		return
	}

	r.RemoteID = init.RunId

	r.createStreamWg.Done()

	r.processStream(stream)
}

func (r *Run) processStream(stream runnerPb.McpRunner_StreamMcpRunClient) {

loop:
	for {
		resp, err := stream.Recv()
		if err != nil {
			log.Printf("Error receiving response: %v\n", err)
			break loop
		}

		switch msg := resp.JobType.(type) {

		case *runnerPb.RunResponse_McpMessage:
			r.messages <- msg.McpMessage

		case *runnerPb.RunResponse_Output:
			r.output <- msg.Output

		case *runnerPb.RunResponse_Error:
			r.errors <- msg.Error
			go r.Close()

		case *runnerPb.RunResponse_Close:
			log.Printf("Run %s closed by server\n", r.RemoteID)
			break loop

		default:
			log.Printf("Unknown response type: %T\n", msg)
		}
	}

}
