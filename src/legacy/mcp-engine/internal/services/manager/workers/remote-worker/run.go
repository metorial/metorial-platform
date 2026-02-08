package remote_worker

import (
	"context"
	"fmt"
	"io"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	mcpPB "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	remotePb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/modules/pubsub"
)

type Run struct {
	context context.Context
	cancel  context.CancelFunc

	ConnectionID string
	Config       *remotePb.RunConfig
	input        *workers.WorkerConnectionInput

	client remotePb.McpRemoteClient
	stream remotePb.McpRemote_StreamMcpRunClient

	doneBroadcaster *pubsub.Broadcaster[struct{}]

	createStreamWg sync.WaitGroup

	messages *pubsub.Broadcaster[*mcp.MCPMessage]
	output   *pubsub.Broadcaster[*mcpPB.McpOutput]
	errors   *pubsub.Broadcaster[*mcpPB.McpError]

	initError error
}

func NewRun(input *workers.WorkerConnectionInput, client remotePb.McpRemoteClient, connectionId string) *Run {
	if client == nil {
		log.Println("McpRemoteClient is nil, cannot create Run")
		return nil
	}

	ctx, cancel := context.WithCancel(context.Background())

	return &Run{
		context: ctx,
		cancel:  cancel,

		Config:       input.RemoteRunConfig,
		ConnectionID: connectionId,

		input:  input,
		client: client,

		doneBroadcaster: pubsub.NewBroadcaster[struct{}](),

		messages: pubsub.NewBroadcaster[*mcp.MCPMessage](),
		errors:   pubsub.NewBroadcaster[*mcpPB.McpError](),
		output:   pubsub.NewBroadcaster[*mcpPB.McpOutput](),
	}
}

func (r *Run) Start() error {
	if r.client == nil {
		return fmt.Errorf("McpRemoteClient is not initialized")
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

	return r.stream.Send(&remotePb.RunRequest{
		Type: &remotePb.RunRequest_McpMessage{
			McpMessage: &remotePb.RunRequestMcpMessage{
				Message: msg,
			},
		},
	})
}

func (r *Run) Close() error {
	r.createStreamWg.Wait()

	stream := r.stream
	if stream == nil {
		return fmt.Errorf("Run stream is not initialized")
	}

	err := stream.Send(&remotePb.RunRequest{
		Type: &remotePb.RunRequest_Close{
			Close: &remotePb.RunRequestClose{},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to send close request: %w", err)
	}

	timeout := time.After(5 * time.Second)

	// Wait for the stream to close
	select {
	case <-r.context.Done():
		stream.CloseSend()
	case <-stream.Context().Done():
		stream.CloseSend()
	case <-timeout:
		stream.CloseSend()
	}

	r.stream = nil

	return nil
}

func (r *Run) Done() pubsub.BroadcasterReader[struct{}] {
	return r.doneBroadcaster
}

func (r *Run) Clone() *Run {
	ctx, cancel := context.WithCancel(context.Background())

	newRun := &Run{
		context: ctx,
		cancel:  cancel,

		Config:       r.Config,
		ConnectionID: uuid.Must(uuid.NewV7()).String(),

		input:  r.input,
		client: r.client,

		doneBroadcaster: pubsub.NewBroadcaster[struct{}](),
		messages:        pubsub.NewBroadcaster[*mcp.MCPMessage](),
		output:          pubsub.NewBroadcaster[*mcpPB.McpOutput](),
		errors:          pubsub.NewBroadcaster[*mcpPB.McpError](),
	}

	return newRun
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
		r.initError = fmt.Errorf("McpRemoteClient is not initialized")
		r.createStreamWg.Done()
		return
	}

	fmt.Printf("Starting MCP run with input client: %+v\n", r.input.MCPClient)

	if r.input.MCPClient == nil {
		// r.initError = fmt.Errorf("MCP client is not initialized")
		r.input.MCPClient = &mcp.MCPClient{
			Info: mcp.ParticipantInfo{
				Name:    "unknown",
				Version: "1.0.0",
			},
			Capabilities:    mcp.Capabilities{},
			ProtocolVersion: mcp.DEFAULT_MCP_VERSION.String(),
			Extra:           map[string]any{},
		}
		r.createStreamWg.Done()
		return
	}

	participant, err := r.input.MCPClient.ToPbParticipant()
	if err != nil {
		r.initError = fmt.Errorf("failed to create participant info: %w", err)
		r.createStreamWg.Done()
		return
	}

	stream, err := r.client.StreamMcpRun(context.Background())
	if err != nil {
		r.initError = fmt.Errorf("failed to create MCP run stream: %w", err)
		r.createStreamWg.Done()
		return
	}

	r.stream = stream
	defer stream.CloseSend()

	err = stream.Send(&remotePb.RunRequest{
		Type: &remotePb.RunRequest_Init{
			Init: &remotePb.RunRequestInit{
				RunConfig:    r.Config,
				ConnectionId: r.ConnectionID,
				Client: &remotePb.RunConfigLambdaClient{
					Participant: participant,
				},
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

		case *remotePb.RunResponse_McpMessage:
			if msg.McpMessage == nil || msg.McpMessage.Message == nil {
				continue
			}

			parsed, _ := mcp.FromPbMessage(msg.McpMessage.Message)
			if parsed != nil {
				r.messages.Publish(parsed)
			}

		case *remotePb.RunResponse_Output:
			if msg.Output == nil || msg.Output.McpOutput == nil {
				continue
			}

			r.output.Publish(msg.Output.McpOutput)

		case *remotePb.RunResponse_Error:
			if msg.Error == nil || msg.Error.McpError == nil {
				continue
			}

			go r.Close()

		case *remotePb.RunResponse_Close:
			log.Printf("Run %s closed by server\n", r.ConnectionID)
			break loop

		default:
			log.Printf("Unknown response type: %T\n", msg)
		}
	}
}
