package runner_worker

import (
	"context"
	"fmt"
	"io"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	mcpPB "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	runnerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/runner"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/modules/pubsub"
	"github.com/metorial/metorial/modules/util"
)

type Run struct {
	context context.Context
	cancel  context.CancelFunc

	ConnectionID string
	Config       *runnerPb.RunConfig

	client runnerPb.McpRunnerClient
	stream runnerPb.McpRunner_StreamMcpRunClient

	doneBroadcaster *pubsub.Broadcaster[struct{}]

	createStreamWg sync.WaitGroup

	messages *pubsub.Broadcaster[*mcp.MCPMessage]
	output   *pubsub.Broadcaster[*mcpPB.McpOutput]
	errors   *pubsub.Broadcaster[*mcpPB.McpError]

	initError error
}

func NewRun(config *runnerPb.RunConfig, client runnerPb.McpRunnerClient, connectionId string) *Run {
	if client == nil {
		log.Println("McpRunnerClient is nil, cannot create Run")
		return nil
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &Run{
		context: ctx,
		cancel:  cancel,

		Config:       config,
		ConnectionID: connectionId,

		client: client,

		doneBroadcaster: pubsub.NewBroadcaster[struct{}](),

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

func (r *Run) SendMessage(msg *mcpPB.McpMessageRaw) error {
	r.createStreamWg.Wait()

	if r.stream == nil {
		return fmt.Errorf("Run stream is not initialized")
	}

	return r.stream.Send(&runnerPb.RunRequest{
		Type: &runnerPb.RunRequest_McpMessage{
			McpMessage: &runnerPb.RunRequestMcpMessage{
				Message: msg,
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
		Type: &runnerPb.RunRequest_Close{
			Close: &runnerPb.RunRequestClose{},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to send close request: %w", err)
	}

	timeout := time.After(5 * time.Second)

	// Wait for the stream to close
	select {
	case <-r.context.Done():
		r.stream.CloseSend()
	case <-r.stream.Context().Done():
		r.stream.CloseSend()
	case <-timeout:
		r.stream.CloseSend()
	}

	r.stream = nil

	return nil
}

func (r *Run) Done() pubsub.BroadcasterReader[struct{}] {
	return r.doneBroadcaster
}

func (r *Run) Clone() *Run {
	return NewRun(r.Config, r.client, util.Must(uuid.NewV7()).String())
}

func (r *Run) handleStream() {
	defer r.cancel()
	defer r.messages.Close()
	defer r.errors.Close()
	defer r.output.Close()
	defer func() {
		r.doneBroadcaster.Publish(struct{}{})
		time.Sleep(500 * time.Millisecond) // Give time for subscribers to receive the done message
		r.doneBroadcaster.Close()
	}()

	if r.client == nil {
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
		Type: &runnerPb.RunRequest_Init{
			Init: &runnerPb.RunRequestInit{
				RunConfig:    r.Config,
				ConnectionId: r.ConnectionID,
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

	r.createStreamWg.Done()

loop:
	for {
		resp, err := stream.Recv()
		if err != nil {
			if err == context.Canceled || err == io.EOF {
				break loop
			}

			log.Printf("Error receiving response: %v\n", err)
			break loop
		}

		switch msg := resp.Type.(type) {

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
			log.Printf("Run %s closed by server\n", r.ConnectionID)
			break loop

		default:
			log.Printf("Unknown response type: %T\n", msg)
		}
	}
}
