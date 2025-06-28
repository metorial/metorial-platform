package mcp_runner_client

import (
	"context"
	"fmt"
	"log"
	"sync"

	mterror "github.com/metorial/metorial/mcp-broker/pkg/mt-error"
	pb "github.com/metorial/metorial/mcp-broker/pkg/proto-mcp-runner"
)

type MessageHandler func(*pb.McpRunResponseMcpMessage) error
type ErrorHandler func(*pb.McpRunResponseError) error
type OutputHandler func(*pb.McpRunResponseOutput) error
type SenderHandler func(*Run)

type Run struct {
	RemoteID string
	Config   *pb.RunConfig

	client pb.McpRunnerClient
	stream pb.McpRunner_StreamMcpRunClient
	done   chan struct{}

	mutex sync.Mutex

	messageHandlers []MessageHandler
	errorHandlers   []ErrorHandler
	outputHandlers  []OutputHandler
	senderHandlers  []SenderHandler
}

func NewRun(config *pb.RunConfig, client pb.McpRunnerClient) *Run {
	return &Run{
		Config: config,

		client: client,
		done:   make(chan struct{}),

		messageHandlers: make([]MessageHandler, 0),
		errorHandlers:   make([]ErrorHandler, 0),
		outputHandlers:  make([]OutputHandler, 0),
		senderHandlers:  make([]SenderHandler, 0),
	}
}

func (r *Run) Start() error {
	if r.client == nil {
		return fmt.Errorf("McpRunnerClient is not initialized")
	}

	if r.stream != nil {
		return fmt.Errorf("Run stream is already initialized")
	}

	r.mutex.Lock()

	stream, err := r.client.StreamMcpRun(context.Background())
	if err != nil {
		return fmt.Errorf("failed to start MCP run stream: %w", err)
	}

	r.stream = stream

	stream.Send(&pb.McpRunRequest{
		JobType: &pb.McpRunRequest_McpInit{
			McpInit: &pb.McpRunRequestInit{
				RunConfig: r.Config,
			},
		},
	})

	resp, err := stream.Recv()
	if err != nil {
		return err
	}

	mcpErr := resp.GetMcpError()
	if mcpErr != nil {
		return mterror.New(
			mcpErr.GetErrorCode().String(),
			mcpErr.GetErrorMessage(),
		)
	}

	init := resp.GetMcpInit()
	if init == nil {
		return mterror.New(
			pb.McpRunErrorCode_MCP_RUN_FAILED_TO_START.String(),
			"Runner did not return a valid MCP Init response",
		)
	}

	r.RemoteID = init.RunId

	r.mutex.Unlock()

	for _, handler := range r.senderHandlers {
		go handler(r)
	}

	r.processStream()

	return nil
}

func (r *Run) SendMessage(message string) error {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if r.stream == nil {
		return mterror.New(
			pb.McpRunErrorCode_MCP_RUN_FAILED_TO_START.String(),
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
	case <-r.done:
		return nil
	case <-r.stream.Context().Done():
		return fmt.Errorf("stream context done before close response received")
	}
}

func (r *Run) AddMessageHandler(handler MessageHandler) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if handler == nil {
		return
	}

	r.messageHandlers = append(r.messageHandlers, handler)
}

func (r *Run) AddErrorHandler(handler ErrorHandler) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if handler == nil {
		return
	}

	r.errorHandlers = append(r.errorHandlers, handler)
}

func (r *Run) AddOutputHandler(handler OutputHandler) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if handler == nil {
		return
	}

	r.outputHandlers = append(r.outputHandlers, handler)
}

func (r *Run) AddSenderHandler(handler SenderHandler) {
	r.mutex.Lock()
	defer r.mutex.Unlock()

	if handler == nil {
		return
	}

	r.senderHandlers = append(r.senderHandlers, handler)
}

func (r *Run) processStream() {

loop:
	for {
		resp, err := r.stream.Recv()
		if err != nil {
			log.Printf("Error receiving response: %v\n", err)
			break
		}

		switch msg := resp.JobType.(type) {

		case *pb.McpRunResponse_McpMessage:
			if len(r.messageHandlers) > 0 {
				for _, handler := range r.messageHandlers {
					if err := handler(msg.McpMessage); err != nil {
						log.Printf("Error handling message: %v\n", err)
					}
				}
			}
		case *pb.McpRunResponse_McpOutput:
			if len(r.outputHandlers) > 0 {
				for _, handler := range r.outputHandlers {
					if err := handler(msg.McpOutput); err != nil {
						log.Printf("Error handling output: %v\n", err)
					}
				}
			}

		case *pb.McpRunResponse_McpError:
			if len(r.errorHandlers) > 0 {
				for _, handler := range r.errorHandlers {
					if err := handler(msg.McpError); err != nil {
						log.Printf("Error handling error: %v\n", err)
					}
				}
			} else {
				log.Printf("MCP Error: %s\n", msg.McpError.ErrorMessage)
			}

			r.stream.Send(&pb.McpRunRequest{
				JobType: &pb.McpRunRequest_McpClose{
					McpClose: &pb.McpRunRequestClose{},
				},
			})

			// No break here, since we want to wait for the close response

		case *pb.McpRunResponse_McpClose:
			log.Println("Run closed by server")
			break loop

		default:
			log.Printf("Unknown response type: %T\n", msg)
		}
	}

	close(r.done)
	if r.stream != nil {
		if err := r.stream.CloseSend(); err != nil {
			log.Printf("Error closing stream: %v\n", err)
		}
	}
}
