package mcp_runner_client

import (
	"context"
	"fmt"
	"log"
	"sync"

	mterror "github.com/metorial/metorial/mcp-broker/pkg/mt-error"
	pb "github.com/metorial/metorial/mcp-broker/pkg/proto-mcp-runner"
)

type Run struct {
	context context.Context
	close   context.CancelFunc

	RemoteID string
	Config   *pb.RunConfig

	client pb.McpRunnerClient
	stream pb.McpRunner_StreamMcpRunClient

	createStreamWg sync.WaitGroup

	messages chan *pb.McpRunResponseMcpMessage
	errors   chan *pb.McpRunResponseError
	output   chan *pb.McpRunResponseOutput

	initError error
}

func NewRun(config *pb.RunConfig, client pb.McpRunnerClient) *Run {
	ctx, cancel := context.WithCancel(context.Background())

	return &Run{
		context: ctx,
		close:   cancel,

		Config: config,

		client: client,

		messages: make(chan *pb.McpRunResponseMcpMessage),
		errors:   make(chan *pb.McpRunResponseError),
		output:   make(chan *pb.McpRunResponseOutput),
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
		return mterror.New(
			pb.McpRunErrorCode_FAILED_TO_START.String(),
			"Run stream is not initialized",
		)
	}

	return r.stream.Send(&pb.McpRunRequest{
		JobType: &pb.McpRunRequest_McpMessage{
			McpMessage: &pb.McpRunRequestMcpMessage{
				Message: message,
			},
		},
	})
}

func (r *Run) Close() error {
	r.createStreamWg.Wait()

	if r.stream == nil {
		return fmt.Errorf("Run stream is not initialized")
	}

	err := r.stream.Send(&pb.McpRunRequest{
		JobType: &pb.McpRunRequest_McpClose{
			McpClose: &pb.McpRunRequestClose{},
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

func (r *Run) Messages() <-chan *pb.McpRunResponseMcpMessage {
	return r.messages
}

func (r *Run) Errors() <-chan *pb.McpRunResponseError {
	return r.errors
}

func (r *Run) Output() <-chan *pb.McpRunResponseOutput {
	return r.output
}

func (r *Run) Done() <-chan struct{} {
	return r.context.Done()
}

func (r *Run) Wait() {
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
		r.initError = mterror.WithInnerError(
			pb.McpRunErrorCode_FAILED_TO_START.String(),
			"Could not connect to Metorial MCP Runner: "+err.Error(),
			err,
		)
		return
	}

	r.stream = stream
	defer stream.CloseSend()

	stream.Send(&pb.McpRunRequest{
		JobType: &pb.McpRunRequest_McpInit{
			McpInit: &pb.McpRunRequestInit{
				RunConfig: r.Config,
			},
		},
	})

	resp, err := stream.Recv()
	if err != nil {
		r.createStreamWg.Done()
		r.initError = mterror.WithInnerError(
			pb.McpRunErrorCode_FAILED_TO_START.String(),
			"Could not connect to Metorial MCP Runner: "+err.Error(),
			err,
		)
		return
	}

	mcpErr := resp.GetMcpError()
	if mcpErr != nil {
		r.createStreamWg.Done()
		r.initError = mterror.New(
			mcpErr.GetErrorCode().String(),
			mcpErr.GetErrorMessage(),
		)
		return
	}

	init := resp.GetMcpInit()
	if init == nil {
		r.createStreamWg.Done()
		r.initError = mterror.New(
			pb.McpRunErrorCode_FAILED_TO_START.String(),
			"Runner did not return a valid MCP Init response",
		)
		return
	}

	r.RemoteID = init.RunId

	r.createStreamWg.Done()

	r.processStream(stream)

	fmt.Printf("Run %s has been initialized successfully\n", r.RemoteID)
}

func (r *Run) processStream(stream pb.McpRunner_StreamMcpRunClient) {

loop:
	for {
		resp, err := stream.Recv()
		if err != nil {
			log.Printf("Error receiving response: %v\n", err)
			break
		}

		log.Printf("Received response: %v\n", resp)

		switch msg := resp.JobType.(type) {

		case *pb.McpRunResponse_McpMessage:
			r.messages <- msg.McpMessage

		case *pb.McpRunResponse_McpOutput:
			r.output <- msg.McpOutput

		case *pb.McpRunResponse_McpError:
			r.errors <- msg.McpError
			go r.Close()

		case *pb.McpRunResponse_McpClose:
			log.Println("Run closed by server")
			break loop

		default:
			log.Printf("Unknown response type: %T\n", msg)
		}
	}

}
