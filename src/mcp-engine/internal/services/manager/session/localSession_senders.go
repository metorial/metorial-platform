package session

import (
	"fmt"
	"log"
	"sync"

	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"google.golang.org/grpc"
)

func sendStreamResponse(
	sendMu *sync.Mutex,
	stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse],
	response *managerPb.McpConnectionStreamResponse,
) error {
	sendMu.Lock()
	defer sendMu.Unlock()

	err := stream.Send(response)
	if err != nil {
		log.Printf("Failed to send steam response message: %v", err)
		return err
	}
	return nil
}

func sendStreamResponseSessionEvent(
	sendMu *sync.Mutex,
	stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse],
	event *managerPb.SessionEvent,
) error {
	response := &managerPb.McpConnectionStreamResponse{
		Response: &managerPb.McpConnectionStreamResponse_SessionEvent{
			SessionEvent: event,
		},
	}

	return sendStreamResponse(sendMu, stream, response)
}

func sendStreamResponseSessionEventInfoSession(
	sendMu *sync.Mutex,
	stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse],
	session *db.Session,
) error {
	pbSes, err := session.ToPb()
	if err != nil {
		return fmt.Errorf("failed to convert session to PB: %w", err)
	}

	event := &managerPb.SessionEvent{
		Event: &managerPb.SessionEvent_InfoSession{
			InfoSession: &managerPb.SessionEventInfoSession{
				Session: pbSes,
			},
		},
	}

	return sendStreamResponseSessionEvent(sendMu, stream, event)
}

func sendStreamResponseSessionEventInfoRun(
	sendMu *sync.Mutex,
	stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse],
	run *db.SessionRun,
) error {
	pbRun, err := run.ToPb()
	if err != nil {
		return fmt.Errorf("failed to convert run to PB: %w", err)
	}

	event := &managerPb.SessionEvent{
		Event: &managerPb.SessionEvent_InfoRun{
			InfoRun: &managerPb.SessionEventInfoRun{
				Run: pbRun,
			},
		},
	}

	return sendStreamResponseSessionEvent(sendMu, stream, event)
}

func sendStreamResponseMcpMessage(
	sendMu *sync.Mutex,
	stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse],
	message *mcp.MCPMessage,
) error {
	response := &managerPb.McpConnectionStreamResponse{
		Response: &managerPb.McpConnectionStreamResponse_McpMessage{
			McpMessage: message.ToPbMessage(),
		},
	}

	return sendStreamResponse(sendMu, stream, response)
}

func sendStreamResponseMcpMessageReplay(
	sendMu *sync.Mutex,
	stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse],
	message *mcp.MCPMessage,
) error {
	response := &managerPb.McpConnectionStreamResponse{
		Response: &managerPb.McpConnectionStreamResponse_McpMessage{
			McpMessage: message.ToPbMessage(),
		},
		IsReplay: true,
	}

	return sendStreamResponse(sendMu, stream, response)
}

func sendStreamResponseMcpError(
	sendMu *sync.Mutex,
	stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse],
	mcpError *mcpPb.McpError,
) error {
	response := &managerPb.McpConnectionStreamResponse{
		Response: &managerPb.McpConnectionStreamResponse_McpError{
			McpError: mcpError,
		},
	}

	return sendStreamResponse(sendMu, stream, response)
}

func sendStreamResponseMcpOutput(
	sendMu *sync.Mutex,
	stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse],
	output *mcpPb.McpOutput,
) error {
	response := &managerPb.McpConnectionStreamResponse{
		Response: &managerPb.McpConnectionStreamResponse_McpOutput{
			McpOutput: output,
		},
	}

	return sendStreamResponse(sendMu, stream, response)
}
