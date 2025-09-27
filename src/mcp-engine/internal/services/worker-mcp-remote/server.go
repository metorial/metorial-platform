package remote

import (
	"context"
	"fmt"
	"io"
	"log"
	"strings"
	"sync"
	"time"

	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	remotePb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
	workerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/worker"
	"github.com/metorial/metorial/mcp-engine/internal/services/worker"
	"google.golang.org/grpc"
)

type remoteServer struct {
	remotePb.UnimplementedMcpRemoteServer

	activeConnections uint32
	totalConnections  uint64

	remote *remote
	worker *worker.Worker

	mutex sync.RWMutex
}

func (r *remoteServer) GetRemoteInfo(context.Context, *remotePb.RemoteInfoRequest) (*remotePb.RemoteInfoResponse, error) {
	r.mutex.RLock()
	defer r.mutex.RUnlock()

	info, err := r.worker.WorkerServer().GetWorkerInfo(context.Background(), &workerPb.WorkerInfoRequest{})
	if err != nil {
		return nil, err
	}

	return &remotePb.RemoteInfoResponse{
		WorkerId:          r.remote.WorkerId(),
		ActiveConnections: r.activeConnections,
		TotalConnections:  r.totalConnections,
		WorkerInfo:        info,
	}, nil
}

func (r *remoteServer) StreamMcpRun(stream grpc.BidiStreamingServer[remotePb.RunRequest, remotePb.RunResponse]) error {
	r.mutex.Lock()
	r.activeConnections++
	r.totalConnections++
	r.mutex.Unlock()

	req, err := stream.Recv()
	if err != nil {
		if err == context.Canceled {
			return nil // Client has closed the stream
		}

		return err // Other error
	}

	msg, ok := req.Type.(*remotePb.RunRequest_Init)
	if !ok {
		return fmt.Errorf("expected McpInit request, got %T", req.Type)
	}

	var conn Connection
	switch msg.Init.RunConfig.Config.(type) {
	case *remotePb.RunConfig_RemoteRunConfig:
		conn, err = NewConnectionSSE(stream.Context(), msg.Init.RunConfig.GetRemoteRunConfig())
		if err != nil {
			log.Printf("Failed to create SSE connection: %v", err)
			return err
		}
	case *remotePb.RunConfig_LambdaRunConfig:
		conn, err = NewConnectionLambdaWs(stream.Context(), msg.Init.RunConfig.GetLambdaRunConfig())
		if err != nil {
			log.Printf("Failed to create SSE connection: %v", err)
			return err
		}
	}

	lastPing := time.Now()

	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-stream.Context().Done():
				return
			case <-conn.Done():
				return

			case <-ticker.C:
				if time.Since(lastPing) > 25*time.Second {
					// Container has not responded in a while, consider it dead
					conn.Close()
					stream.Send(&remotePb.RunResponse{
						Type: &remotePb.RunResponse_Error{
							Error: &remotePb.RunResponseError{
								McpError: &mcpPb.McpError{
									ErrorMessage: "Connection timed out",
									ErrorCode:    mcpPb.McpError_timeout,
								},
							},
						},
					})
					stream.Send(&remotePb.RunResponse{
						Type: &remotePb.RunResponse_Close{
							Close: &remotePb.RunResponseClose{},
						},
					})

					return
				}

				conn.SendControl(
					fmt.Sprintf(`{"jsonrpc": "2.0", "id": "mtr/ping/%d", "method": "ping", "params": {}}`, time.Now().UnixMicro()),
				)
			}
		}
	}()

	conn.Subscribe(func(response *remotePb.RunResponse) {
		lastPing = time.Now()

		message, ok := response.Type.(*remotePb.RunResponse_McpMessage)
		if ok && message != nil {
			if message.McpMessage.Message.MessageType == mcpPb.McpMessageType_response &&
				strings.HasPrefix(message.McpMessage.Message.IdString, "mtr/ping/") {
				return // Ignore ping responses
			}

			if message.McpMessage.Message.MessageType == mcpPb.McpMessageType_request &&
				message.McpMessage.Message.Method == "ping" {
				conn.SendControl(
					fmt.Sprintf(`{"jsonrpc": "2.0", "id": %s, "result": {}}`, message.McpMessage.Message.IdJson),
				)

				return // Ignore ping requests
			}
		}

		err := stream.Send(response)
		if err != nil {
			if stream.Context().Err() != nil {
				log.Printf("Stream context error: %v", stream.Context().Err())
				return // Client has closed the stream
			}

			log.Printf("Failed to send response: %v", err)
			return
		}
	})

	err = stream.Send(&remotePb.RunResponse{
		Type: &remotePb.RunResponse_Init{
			Init: &remotePb.RunResponseInit{},
		},
	})
	if err != nil {
		return err
	}

	errChan := make(chan error, 1)
	defer func() {
		close(errChan)
		errChan = nil
	}()

	go func() {
		for {
			req, err := stream.Recv()
			if err != nil {
				conn.Close()

				if err == context.Canceled || err == io.EOF {
					return // Client has closed the stream
				}

				errChan <- fmt.Errorf("failed to receive request: %w", err)
				return
			}

			switch msg := req.Type.(type) {

			case *remotePb.RunRequest_McpMessage:
				err = conn.Send(msg.McpMessage.Message)
				if err != nil {
					errChan <- fmt.Errorf("failed to send MCP message: %w", err)
				}

			case *remotePb.RunRequest_Close:
				err := conn.Close()
				if err != nil {
					errChan <- fmt.Errorf("failed to close connection: %w", err)
				}

				err = stream.Send(&remotePb.RunResponse{
					Type: &remotePb.RunResponse_Close{
						Close: &remotePb.RunResponseClose{},
					},
				})
				if err != nil {
					log.Printf("Failed to send close response: %v", err)
					errChan <- fmt.Errorf("failed to send close response: %w", err)
				}

				return

			default:
				errChan <- fmt.Errorf("unexpected request type: %T", msg)
				return
			}
		}
	}()

	select {
	case err := <-errChan:
		if err != nil {
			log.Printf("Remote server error: %v", err)
			conn.Close()
			break
		}

	case <-stream.Context().Done():
		// Client has closed the stream, clean up
		conn.Close()
		break

	case <-conn.Done():
		// Connection has been closed, clean up
		conn.Close()
		stream.Send(&remotePb.RunResponse{
			Type: &remotePb.RunResponse_Close{
				Close: &remotePb.RunResponseClose{},
			},
		})
		break
	}

	r.mutex.Lock()
	r.activeConnections--
	r.mutex.Unlock()

	time.Sleep(100 * time.Millisecond) // Give some time for the stream to close gracefully

	return nil
}
