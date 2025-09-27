package remote

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	mcpPb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/mcp"
	remotePb "github.com/metorial/metorial/mcp-engine/gen/mcp-engine/remote"
)

type BaseMessage struct {
	Type string `json:"type"`
}

type LogsMessage_Line struct {
	Type string `json:"type"`
	Line string `json:"line"`
}

type LogsMessage struct {
	Type  string   `json:"type"`
	Lines []string `json:"lines"`
}

type McpNotificationMessage struct {
	Type         string          `json:"type"`
	Notification json.RawMessage `json:"notification"`
}

type McpResponseMessage struct {
	Type     string          `json:"type"`
	Response json.RawMessage `json:"response"`
}

type McpRequestMessage_Mcp struct {
	Client       map[string]string `json:"client"`
	Capabilities any               `json:"capabilities,omitempty"`
}

type McpRequestMessage_Opts struct {
	TimeoutMs int64 `json:"timeoutMs"`
}

type McpRequestMessage struct {
	Type    string                 `json:"type"`
	Request json.RawMessage        `json:"request"`
	Mcp     McpRequestMessage_Mcp  `json:"mcp"`
	Opts    McpRequestMessage_Opts `json:"opts"`
}

type ErrorMessage struct {
	Type  string `json:"type"`
	Error string `json:"error"`
}

type ConnectionLambdaWs struct {
	context context.Context
	cancel  context.CancelCauseFunc

	extraOutputChan chan *remotePb.RunResponse

	config *remotePb.RunConfigLambda

	activeConnection *websocket.Conn
	connectionMutex  sync.Mutex

	mutex sync.Mutex
}

func NewConnectionLambdaWs(ctx context.Context, config *remotePb.RunConfigLambda) (*ConnectionLambdaWs, error) {
	ctx, cancel := context.WithCancelCause(ctx)

	res := &ConnectionLambdaWs{
		context: ctx,
		cancel:  cancel,

		config: config,

		extraOutputChan: make(chan *remotePb.RunResponse, 10),
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

	u := url.URL{Scheme: "wss", Host: baseUrl.Host, Path: baseUrl.Path, RawQuery: baseUrl.RawQuery}
	headers := http.Header{}
	headers.Set("User-Agent", "Metorial MCP Engine (https://metorial.com)")
	headers.Set("X-Metorial-Stellar-Token", *c.config.Server.SecurityToken)

	conn, _, err := websocket.DefaultDialer.Dial(u.String(), headers)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to WebSocket server: %w", err)
	}

	c.activeConnection = conn

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
	// conn, err := c.ensureConnection()
	// if err != nil {
	// 	return fmt.Errorf("failed to ensure WebSocket connection: %w", err)
	// }

	// msg :=

	return nil
}

func (c *ConnectionLambdaWs) SendControl(msg string) error {
	return nil
}

func (c *ConnectionLambdaWs) Subscribe(cb MessageReceiver) {

}

func (c *ConnectionLambdaWs) Close() error {
	c.mutex.Lock()
	defer c.mutex.Unlock()

	if c.cancel != nil {
		c.cancel(nil)
		c.cancel = nil
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
