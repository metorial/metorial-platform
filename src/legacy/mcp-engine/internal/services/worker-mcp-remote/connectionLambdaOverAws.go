package remote

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	lambdasdk "github.com/aws/aws-sdk-go-v2/service/lambda"
	lambdatypes "github.com/aws/aws-sdk-go-v2/service/lambda/types"
	"github.com/google/uuid"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	remotePb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
	"github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/modules/util"
)

type ConnectionLambdaOverAwsApi struct {
	context context.Context
	cancel  context.CancelCauseFunc

	outputChan chan *remotePb.RunResponse

	config *remotePb.RunConfigLambda
	client *remotePb.RunConfigLambdaClient

	lambdaClient *lambdasdk.Client
	functionName string

	mutex  sync.Mutex
	wg     sync.WaitGroup
	closed bool
}

type LambdaMcpMessageRequest struct {
	Action          string   `json:"action"`
	Messages        []string `json:"messages"`
	ParticipantJson string   `json:"participantJson,omitempty"`
	Args            string   `json:"args,omitempty"`
}

type LambdaMcpMessageResponse struct {
	Success   bool                            `json:"success"`
	Logs      []LambdaLogGroup                `json:"logs"`
	Responses *[]string                       `json:"responses"`
	Error     *LambdaMcpMessageResponse_Error `json:"error,omitempty"`
}

type LambdaMcpMessageResponse_Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type LambdaLogGroup struct {
	Type  string   `json:"type"`
	Lines []string `json:"lines"`
}

type LambdaMcpMessageRequest_ClientInfo struct {
	Name    string `json:"name,omitempty"`
	Version string `json:"version,omitempty"`
}

func NewConnectionLambdaOverAwsApi(ctx context.Context, lambdaClient *lambdasdk.Client, client *remotePb.RunConfigLambdaClient, config *remotePb.RunConfigLambda) (*ConnectionLambdaOverAwsApi, error) {
	if lambdaClient == nil {
		return nil, fmt.Errorf("missing AWS Lambda client")
	}

	if config == nil || config.Server == nil {
		return nil, fmt.Errorf("missing ProviderResourceAccessIdentifier in config")
	}

	ctx, cancel := context.WithCancelCause(ctx)

	conn := &ConnectionLambdaOverAwsApi{
		context:      ctx,
		cancel:       cancel,
		outputChan:   make(chan *remotePb.RunResponse, 50),
		config:       config,
		client:       client,
		lambdaClient: lambdaClient,
		functionName: config.Server.ProviderResourceAccessIdentifier,
	}

	return conn, nil
}

func (c *ConnectionLambdaOverAwsApi) ensureOpen() error {
	c.mutex.Lock()
	defer c.mutex.Unlock()
	if c.closed {
		return fmt.Errorf("connection closed")
	}
	return nil
}

func (c *ConnectionLambdaOverAwsApi) Send(msg *mcpPb.McpMessageRaw) error {
	return c.SendMcp(msg.Message)
}

func (c *ConnectionLambdaOverAwsApi) SendControl(msg string) error {
	return c.SendMcp(msg)
}

func (c *ConnectionLambdaOverAwsApi) SendMcp(msg string) error {
	if err := c.ensureOpen(); err != nil {
		return err
	}

	req := LambdaMcpMessageRequest{
		Action:          "mcp.request",
		Messages:        []string{msg},
		ParticipantJson: c.client.Participant.ParticipantJson,
		Args:            c.config.Arguments.JsonArguments,
	}
	payload, err := json.Marshal(req)
	if err != nil {
		return fmt.Errorf("failed to marshal lambda payload: %w", err)
	}

	ctx, cancel := context.WithTimeout(c.context, 35*time.Second)
	defer cancel()

	invokeInput := &lambdasdk.InvokeInput{
		FunctionName:   aws.String(c.functionName),
		Payload:        payload,
		InvocationType: lambdatypes.InvocationTypeRequestResponse,
		LogType:        lambdatypes.LogTypeTail,
	}

	resp, err := c.lambdaClient.Invoke(ctx, invokeInput)
	if err != nil {
		return fmt.Errorf("lambda invoke error: %w", err)
	}

	if resp.FunctionError != nil {
		msg := fmt.Sprintf("lambda function error: %s", *resp.FunctionError)
		var body map[string]interface{}
		_ = json.Unmarshal(resp.Payload, &body)
		if v, ok := body["errorMessage"].(string); ok {
			msg = fmt.Sprintf("%s: %s", msg, v)
		}
		c.pushExecutionError("remote_lambda_error", msg)
	}

	if resp.Payload == nil {
		return nil
	}

	var arr []json.RawMessage
	if err := json.Unmarshal(resp.Payload, &arr); err == nil {
		for _, raw := range arr {
			c.processIncomingRaw(raw)
		}
		return nil
	}

	c.processIncomingRaw(resp.Payload)
	return nil
}

func (c *ConnectionLambdaOverAwsApi) processIncomingRaw(raw json.RawMessage) {
	var response LambdaMcpMessageResponse
	if err := json.Unmarshal(raw, &response); err != nil {
		log.Printf("lambda response unmarshal base error: %v", err)
		return
	}

	for _, line := range response.Logs {
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

	if response.Responses != nil {
		for _, msgStr := range *response.Responses {
			msg, err := mcp.ParseMCPMessage(util.Must(uuid.NewV7()).String(), msgStr)
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
				return
			}
			c.outputChan <- &remotePb.RunResponse{
				Type: &remotePb.RunResponse_McpMessage{
					McpMessage: &remotePb.RunResponseMcpMessage{
						Message: msg.ToPbMessage(),
					},
				},
			}
		}
	}

	if response.Error != nil {
		c.outputChan <- &remotePb.RunResponse{
			Type: &remotePb.RunResponse_Error{
				Error: &remotePb.RunResponseError{
					McpError: &mcpPb.McpError{
						ErrorCode:    mcpPb.McpError_execution_error,
						ErrorMessage: response.Error.Message,
						Metadata: map[string]string{
							"remote_code": response.Error.Code,
						},
					},
				},
			},
		}
	}
}

func (c *ConnectionLambdaOverAwsApi) pushExecutionError(code, message string) {
	c.outputChan <- &remotePb.RunResponse{
		Type: &remotePb.RunResponse_Error{
			Error: &remotePb.RunResponseError{
				McpError: &mcpPb.McpError{
					ErrorCode:    mcpPb.McpError_execution_error,
					ErrorMessage: message,
					Metadata: map[string]string{
						"remote_code": code,
					},
				},
			},
		},
	}
}

func (c *ConnectionLambdaOverAwsApi) Subscribe(cb MessageReceiver) {
	c.wg.Add(1)
	go func() {
		defer c.wg.Done()
		for {
			select {
			case <-c.context.Done():
				return
			case msg, ok := <-c.outputChan:
				if !ok {
					return
				}
				func() {
					defer func() {
						if r := recover(); r != nil {
							log.Printf("panic in subscriber callback: %v", r)
						}
					}()
					cb(msg)
				}()
			}
		}
	}()
}

func (c *ConnectionLambdaOverAwsApi) Close() error {
	c.mutex.Lock()
	if c.closed {
		c.mutex.Unlock()
		return nil
	}
	c.closed = true
	c.mutex.Unlock()

	if c.cancel != nil {
		c.cancel(nil)
		c.cancel = nil
	}

	go func() {
		c.wg.Wait()
		c.mutex.Lock()
		if c.outputChan != nil {
			close(c.outputChan)
			c.outputChan = nil
		}
		c.mutex.Unlock()
	}()

	return nil
}

func (c *ConnectionLambdaOverAwsApi) Context() context.Context {
	if c.context == nil {
		return context.Background()
	}
	return c.context
}

func (c *ConnectionLambdaOverAwsApi) Done() <-chan struct{} {
	if c.context == nil {
		return nil
	}
	return c.context.Done()
}

func (c *ConnectionLambdaOverAwsApi) Wait() error {
	<-c.context.Done()
	if c.context.Err() != nil {
		return c.context.Err()
	}
	return nil
}
