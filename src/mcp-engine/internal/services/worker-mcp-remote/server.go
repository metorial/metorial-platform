package remote

import (
	"context"
	"fmt"
	"log"
	"sync"

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

	var con Connection
	if msg.Init.RunConfig.Server.Protocol == remotePb.RunConfigRemoteServer_sse {
		con, err = NewConnectionSSE(stream.Context(), msg.Init.RunConfig)
		if err != nil {
			return fmt.Errorf("failed to create SSE connection: %w", err)
		}
	} else {
		return fmt.Errorf("unsupported protocol: %s", msg.Init.RunConfig.Server.Protocol)
	}

	con.Subscribe(func(response *remotePb.RunResponse) {
		err := stream.Send(response)
		if err != nil {
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

	for {
		req, err := stream.Recv()
		if err != nil {
			con.Close()

			if err == context.Canceled {
				return nil // Client has closed the stream
			}

			return fmt.Errorf("failed to receive request: %w", err)
		}

		switch msg := req.Type.(type) {
		case *remotePb.RunRequest_McpMessage:
			err = con.Send(msg.McpMessage.Message)
			if err != nil {
				log.Printf("Failed to send MCP message: %v", err)
				return err
			}
		case *remotePb.RunRequest_Close:
			err := con.Close()
			if err != nil {
				log.Printf("Failed to close connection: %v", err)
				return fmt.Errorf("failed to close connection: %w", err)
			}

			r.mutex.Lock()
			r.activeConnections--
			r.mutex.Unlock()

			err = stream.Send(&remotePb.RunResponse{
				Type: &remotePb.RunResponse_Close{
					Close: &remotePb.RunResponseClose{},
				},
			})
			if err != nil {
				log.Printf("Failed to send close response: %v", err)
				return fmt.Errorf("failed to send close response: %w", err)
			}

		default:
			return fmt.Errorf("unexpected request type: %T", msg)
		}
	}

}
