package client

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"github.com/google/uuid"
	"github.com/mark3labs/mcp-go/client/transport"
	"github.com/mark3labs/mcp-go/mcp"
	"github.com/metorial/metorial/mcp-engine/internal/services/manager/workers"

	ourMcp "github.com/metorial/metorial/mcp-engine/pkg/mcp"
	"github.com/metorial/metorial/mcp-engine/pkg/util"
)

type MetorialTransport struct {
	connection workers.WorkerConnection

	responses      map[string]chan *transport.JSONRPCResponse
	mu             sync.RWMutex
	onNotification func(mcp.JSONRPCNotification)
	notifyMu       sync.RWMutex

	ctx   context.Context
	ctxMu sync.RWMutex
}

func NewMetorialTransport(connection workers.WorkerConnection) *MetorialTransport {
	return &MetorialTransport{
		connection: connection,
		responses:  make(map[string]chan *transport.JSONRPCResponse),
	}
}

func (t *MetorialTransport) GetSessionId() string {
	return t.connection.ConnectionID()
}

func (t *MetorialTransport) Start(ctx context.Context) error {
	t.ctxMu.Lock()
	t.ctx = ctx
	t.ctxMu.Unlock()

	// Start the connection and handle incoming messages
	go t.handleMessages()

	return nil
}

func (t *MetorialTransport) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()

	// t.connection.Close()

	return nil
}

func (t *MetorialTransport) SendRequest(ctx context.Context, request transport.JSONRPCRequest) (*transport.JSONRPCResponse, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	request.ID = wrapRequestId(request.ID)

	id := request.ID.String()

	// Create a channel for the response
	responseChan := make(chan *transport.JSONRPCResponse, 1)
	t.responses[id] = responseChan
	defer func() {
		t.mu.Lock()
		delete(t.responses, id)
		t.mu.Unlock()
		close(responseChan)
	}()

	done := t.connection.Done().Subscribe()
	defer t.connection.Done().Unsubscribe(done)

	json, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	msg, err := ourMcp.ParseMCPMessageFromBytes(util.Must(uuid.NewV7()).String(), json)
	if err != nil {
		return nil, fmt.Errorf("failed to parse MCP message: %w", err)
	}

	err = t.connection.AcceptMessage(msg)
	if err != nil {
		return nil, err
	}

	// Wait for the response
	select {
	case response := <-responseChan:
		return response, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-t.ctx.Done():
		return nil, t.ctx.Err()
	case <-done:
		return nil, fmt.Errorf("connection closed while waiting for response")
	}
}

func (t *MetorialTransport) SendNotification(ctx context.Context, notification mcp.JSONRPCNotification) error {
	t.mu.Lock()
	defer t.mu.Unlock()

	json, err := json.Marshal(notification)
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	msg, err := ourMcp.ParseMCPMessageFromBytes(util.Must(uuid.NewV7()).String(), json)
	if err != nil {
		return fmt.Errorf("failed to parse MCP message: %w", err)
	}

	err = t.connection.AcceptMessage(msg)
	if err != nil {
		return err
	}

	return nil
}

func (t *MetorialTransport) SetNotificationHandler(handler func(notification mcp.JSONRPCNotification)) {
	t.notifyMu.Lock()
	defer t.notifyMu.Unlock()

	t.onNotification = handler
}

func (t *MetorialTransport) handleMessages() {
	msgChan := t.connection.Messages().Subscribe()
	defer t.connection.Messages().Unsubscribe(msgChan)

	done := t.connection.Done().Subscribe()
	defer t.connection.Done().Unsubscribe(done)

	for {
		select {
		case <-t.ctx.Done():
			return
		case <-done:
			return
		case message := <-msgChan:
			if message == nil {
				continue
			}

			go func() {
				switch message.MsgType {

				case ourMcp.NotificationType:
					var notification mcp.JSONRPCNotification
					if err := json.Unmarshal(message.GetRawPayload(), &notification); err != nil {
						return
					}
					t.notifyMu.RLock()
					if t.onNotification != nil {
						t.onNotification(notification)
					}
					t.notifyMu.RUnlock()

				case ourMcp.ResponseType:
					var response transport.JSONRPCResponse
					if err := json.Unmarshal(message.GetRawPayload(), &response); err != nil {
						return
					}
					t.mu.Lock()
					if responseChan, ok := t.responses[response.ID.String()]; ok {
						responseChan <- &response
					}
					t.mu.Unlock()

				}
			}()
		}
	}
}

func wrapRequestId(reqId mcp.RequestId) mcp.RequestId {
	return mcp.NewRequestId(
		fmt.Sprintf("mte/w/%s", reqId.String()),
	)
}
