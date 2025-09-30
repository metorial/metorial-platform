package remote

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/gorilla/websocket"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	remotePb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/modules/util"
)

type BaseMessage struct {
	Type string `json:"type"`
}

type LogsMessage_Line struct {
	Type  string   `json:"type"`
	Lines []string `json:"lines"`
}

type LogsMessage struct {
	Type  string             `json:"type"`
	Lines []LogsMessage_Line `json:"lines"`
}

type McpMessageResponse struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

type McpMessageRequest_Opts struct {
	TimeoutMs int64 `json:"timeoutMs"`
}

type McpMessageRequest struct {
	Type    string                 `json:"type"`
	Message string                 `json:"message"`
	Opts    McpMessageRequest_Opts `json:"opts"`
	// Capabilities any                    `json:"capabilities,omitempty"`
}

type RemoteError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type ErrorMessage struct {
	Type  string      `json:"type"`
	Error RemoteError `json:"error"`
}

type ConnectionLambdaWs struct {
	context context.Context
	cancel  context.CancelCauseFunc

	outputChan chan *remotePb.RunResponse

	config *remotePb.RunConfigLambda

	activeConnection *websocket.Conn
	connectionMutex  sync.Mutex

	client *remotePb.RunConfigLambdaClient

	mutex sync.Mutex
}

func NewConnectionLambdaWs(ctx context.Context, client *remotePb.RunConfigLambdaClient, config *remotePb.RunConfigLambda) (*ConnectionLambdaWs, error) {
	ctx, cancel := context.WithCancelCause(ctx)

	res := &ConnectionLambdaWs{
		context: ctx,
		cancel:  cancel,

		outputChan: make(chan *remotePb.RunResponse, 10),

		config: config,
		client: client,
	}

	if res.context.Err() != nil {
		return nil, context.Cause(res.context)
	}

	return res, nil
}

func (c *ConnectionLambdaWs) ensureConnection() (*websocket.Conn, error) {
	c.connectionMutex.Lock()
	defer c.connectionMutex.Unlock()

	if c.activeConnection != nil {
		return c.activeConnection, nil
	}

	baseUrl, err := url.ParseRequestURI(*c.config.Server.ProviderResourceAccessIdentifier)
	if err != nil {
		return nil, fmt.Errorf("failed to parse WebSocket URL: %w", err)
	}

	u := url.URL{Scheme: "wss", Host: baseUrl.Host, Path: "/mcp", RawQuery: baseUrl.RawQuery}

	headers := http.Header{}
	headers.Set("User-Agent", "Metorial MCP Engine (https://metorial.com)")
	headers.Set("Metorial-Stellar-Token", *c.config.Server.SecurityToken)
	headers.Set("Metorial-Stellar-Client", c.client.Participant.ParticipantJson)
	headers.Set("Metorial-Stellar-Arguments", c.config.Arguments.JsonArguments)

	conn, _, err := websocket.DefaultDialer.Dial(u.String(), headers)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to WebSocket server: %w", err)
	}

	c.activeConnection = conn

	go func() {
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				log.Println("lambda ws read error:", err)
				return
			}

			// First unmarshal into BaseMessage to check type
			var base BaseMessage
			if err := json.Unmarshal(message, &base); err != nil {
				log.Println("lambda ws unmarshal error:", err)
				continue
			}

			switch base.Type {
			case "logs":
				var logsMsg LogsMessage
				if err := json.Unmarshal(message, &logsMsg); err != nil {
					log.Println("lambda ws unmarshal logs error:", err)
					continue
				}

				for _, line := range logsMsg.Lines {
					OutputType := mcpPb.McpOutput_stdout
					if line.Type == "error" {
						OutputType = mcpPb.McpOutput_stderr
					}

					c.outputChan <- &remotePb.RunResponse{
						Type: &remotePb.RunResponse_Output{
							Output: &remotePb.RunResponseOutput{
								McpOutput: &mcpPb.McpOutput{
									OutputType: OutputType,
									Uuid:       util.Must(uuid.NewV7()).String(),
									Lines:      line.Lines,
								},
							},
						},
					}
				}
			case "mcp.message":
				var mcpMsg McpMessageResponse
				if err := json.Unmarshal(message, &mcpMsg); err != nil {
					log.Println("lambda ws unmarshal mcp message error:", err)
					continue
				}

				msg, err := mcp.ParseMCPMessage(util.Must(uuid.NewV7()).String(), mcpMsg.Message)
				if err != nil {
					c.outputChan <- &remotePb.RunResponse{
						Type: &remotePb.RunResponse_Output{
							Output: &remotePb.RunResponseOutput{
								McpOutput: &mcpPb.McpOutput{
									OutputType: mcpPb.McpOutput_remote,
									Uuid:       util.Must(uuid.NewV7()).String(),
									Lines:      []string{fmt.Sprintf("Failed to parse MCP message: %v", err)},
								},
							},
						},
					}
				}

				c.outputChan <- &remotePb.RunResponse{
					Type: &remotePb.RunResponse_McpMessage{
						McpMessage: &remotePb.RunResponseMcpMessage{
							Message: msg.ToPbMessage(),
						},
					},
				}
			case "error":
				var errMsg ErrorMessage
				if err := json.Unmarshal(message, &errMsg); err != nil {
					log.Println("lambda ws unmarshal error message error:", err)
					continue
				}

				c.outputChan <- &remotePb.RunResponse{
					Type: &remotePb.RunResponse_Error{
						Error: &remotePb.RunResponseError{
							McpError: &mcpPb.McpError{
								ErrorCode:    mcpPb.McpError_execution_error,
								ErrorMessage: errMsg.Error.Message,
								Metadata: map[string]string{
									"remote_code": errMsg.Error.Code,
								},
							},
						},
					},
				}

			default:
				log.Printf("lambda ws unknown message type: %s\n", base.Type)
			}
		}
	}()

	go func() {
		timer1 := time.NewTimer(15 * time.Second)
		defer timer1.Stop()

		select {
		case <-c.context.Done():
			return
		case <-timer1.C:
		}

		c.mutex.Lock()
		connectionToClose := c.activeConnection
		c.activeConnection = nil
		c.mutex.Unlock()

		timer2 := time.NewTimer(5 * time.Second)
		defer timer2.Stop()

		select {
		case <-c.context.Done():
			return
		case <-timer2.C:
		}

		if connectionToClose != nil {
			connectionToClose.Close()
		}
	}()

	return conn, nil
}

func (c *ConnectionLambdaWs) Send(msg *mcpPb.McpMessageRaw) error {
	return c.SendMcp(msg.Message)
}

func (c *ConnectionLambdaWs) SendControl(msg string) error {
	return c.SendMcp(msg)
}

func (c *ConnectionLambdaWs) SendMcp(msg string) error {
	conn, err := c.ensureConnection()
	if err != nil {
		return fmt.Errorf("failed to ensure WebSocket connection: %w", err)
	}

	req := McpMessageRequest{
		Type:    "mcp.message",
		Message: msg,
		Opts: McpMessageRequest_Opts{
			TimeoutMs: 30000,
		},
	}

	return conn.WriteJSON(req)
}

func (c *ConnectionLambdaWs) Subscribe(cb MessageReceiver) {
	go func() {
		for {
			select {
			case <-c.context.Done():
				return
			case msg, ok := <-c.outputChan:
				if !ok {
					return
				}

				cb(msg)
			}
		}
	}()
}

func (c *ConnectionLambdaWs) Close() error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if c.cancel != nil {
		c.cancel(nil)
		c.cancel = nil
	}

	// if c.activeConnection != nil {
	// 	c.activeConnection.Close()
	// 	c.activeConnection = nil
	// }

	if c.outputChan != nil {
		close(c.outputChan)
		c.outputChan = nil
	}

	return nil
}

func (c *ConnectionLambdaWs) Context() context.Context {
	if c.context == nil {
		return context.Background()
	}

	return c.context
}

func (c *ConnectionLambdaWs) Done() <-chan struct{} {
	if c.context == nil {
		return nil
	}

	return c.context.Done()
}

func (c *ConnectionLambdaWs) Wait() error {
	<-c.context.Done()

	if c.context.Err() != nil {
		return c.context.Err()
	}

	return nil
}
