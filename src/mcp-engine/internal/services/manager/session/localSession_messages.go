package session

import (
	"fmt"

	"github.com/getsentry/sentry-go"
	managerPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/manager"
	"github.com/metorial/metorial/mcp-engine/internal/db"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	mterror "github.com/metorial/metorial/mcp-engine/pkg/mtError"
	"google.golang.org/grpc"
)

func (s *LocalSession) parseMessages(req *managerPb.SendMcpMessageRequest) (*mcp.MCPMessage, []*mcp.MCPMessage, *mterror.MTError) {
	var initMessage *mcp.MCPMessage = nil

	// Parse the MCP messages from the request
	mcpMessages := make([]*mcp.MCPMessage, 0, len(req.McpMessages))
	for _, rawMessage := range req.McpMessages {
		message, err := mcp.FromPbRawMessage(rawMessage)
		if err != nil {
			s.CreateStructuredError(
				"mcp_message_parse_error",
				"failed to parse MCP message",
				map[string]string{
					"message":        rawMessage.Message,
					"internal_error": err.Error(),
				},
			)

			return nil, nil, mterror.NewWithCodeAndInnerError(mterror.InvalidRequestKind, "run_error", "failed to parse MCP message", err)
		}

		// Initializations are handled separately
		// they are not sent to the worker directly
		// but we need them to set the MCP client.
		// If the MCP client is not set, the `ensureConnection`
		// method will block until it is set.
		thisIsInit := *message.Method == "initialize"
		if thisIsInit {
			if initMessage != nil {
				s.CreateStructuredError(
					"mcp_message_parse_error",
					"multiple initialize messages in request",
					map[string]string{
						"message": rawMessage.Message,
					},
				)

				return nil, nil, mterror.New(mterror.InvalidRequestKind, "multiple initialize messages in request")
			}

			client, err := mcp.McpClientFromInitMessage(message)
			if err != nil {
				s.CreateStructuredError(
					"mcp_message_parse_error",
					"failed to parse MCP message, invalid initialize message",
					map[string]string{
						"message":        rawMessage.Message,
						"internal_error": err.Error(),
					},
				)

				return nil, nil, mterror.NewWithCodeAndInnerError(mterror.InvalidRequestKind, "run_error", "failed to parse MCP message, invalid initialize message", err)
			}

			s.setMcpClient(client)
			initMessage = message
		} else {
			mcpMessages = append(mcpMessages, message)
		}
	}

	return initMessage, mcpMessages, nil
}

func (s *LocalSession) handleInitMessage(
	initMessage *mcp.MCPMessage,
	connection workers.WorkerConnection,
	run *db.SessionRun,
	stream grpc.ServerStreamingServer[managerPb.McpConnectionStreamResponse],
	includeResponses bool,
) error {
	if initMessage == nil {
		return nil // No initialization message to handle
	}

	var err error

	var message *mcp.MCPMessage

	if s.dbSession.Server != nil && s.dbSession.Server.McpServer != nil {
		message, err = s.dbSession.Server.McpServer.ToInitMessage(s.mcpClient, initMessage)
		if err != nil {
			return fmt.Errorf("failed to process server init message: %w", err)
		}
	} else {
		server, err := connection.GetServer()
		if err != nil {
			sentry.CaptureException(err)
			s.CreateStructuredErrorWithRun(
				run,
				"run_error",
				"failed to get server info",
				map[string]string{
					"internal_error": err.Error(),
				},
			)

			return fmt.Errorf("failed to get server info: %w", err)
		}

		message, err = server.ToInitMessage(s.mcpClient, initMessage)
		if err != nil {
			sentry.CaptureException(err)
			return fmt.Errorf("failed to process server init message: %w", err)
		}
	}

	s.internalMessages.Publish(message)

	// We need to explicitly send the init message to the stream here since
	// the message listener only starts when the connection is established.
	// And the connection is established after the init message is sent.
	if includeResponses {
		err = sendStreamResponseMcpMessage(stream, message)
		if err != nil {
			return err
		}
	}

	return nil
}
