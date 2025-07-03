package runner_worker

import (
	"context"
	"fmt"
	"log"
	"sync"

	mcpPB "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	runnerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/runner"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/pubsub"
)

type Run struct {
	context context.Context
	cancel  context.CancelFunc

	RemoteID string
	Config   *runnerPb.RunConfig

	client runnerPb.McpRunnerClient
	stream runnerPb.McpRunner_StreamMcpRunClient

	createStreamWg sync.WaitGroup

	messages *pubsub.Broadcaster[*mcp.MCPMessage]
	output   *pubsub.Broadcaster[*mcpPB.McpOutput]
	errors   *pubsub.Broadcaster[*mcpPB.McpError]

	initError error
}

func NewRun(config *runnerPb.RunConfig, client runnerPb.McpRunnerClient) *Run {
	if client == nil {
		log.Println("McpRunnerClient is nil, cannot create Run")
		return nil
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &Run{
		context: ctx,
		cancel:  cancel,

		Config: config,

		client: client,

		messages: pubsub.NewBroadcaster[*mcp.MCPMessage](),
		errors:   pubsub.NewBroadcaster[*mcpPB.McpError](),
		output:   pubsub.NewBroadcaster[*mcpPB.McpOutput](),
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
				Message: &mcpPB.McpMessageRaw{
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
	defer r.cancel()
	defer r.messages.Close()
	defer r.errors.Close()
	defer r.output.Close()

	if r.client == nil {
		log.Println("McpRunnerClient is nil, cannot create stream")
		r.createStreamWg.Done()
		r.initError = fmt.Errorf("McpRunnerClient is not initialized")
		return
	}

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
		r.errors.Publish(mcpErr.McpError)
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
			if msg.McpMessage == nil || msg.McpMessage.Message == nil {
				continue
			}

			parsed, _ := mcp.FromPbRawMessage(msg.McpMessage.Message)
			if parsed != nil {
				r.messages.Publish(parsed)
			}

		case *runnerPb.RunResponse_Output:
			if msg.Output == nil || msg.Output.McpOutput == nil {
				continue
			}

			r.output.Publish(msg.Output.McpOutput)

		case *runnerPb.RunResponse_Error:
			if msg.Error == nil || msg.Error.McpError == nil {
				continue
			}

			go r.Close()

		case *runnerPb.RunResponse_Close:
			log.Printf("Run %s closed by server\n", r.RemoteID)
			break loop

		default:
			log.Printf("Unknown response type: %T\n", msg)
		}
	}

}
