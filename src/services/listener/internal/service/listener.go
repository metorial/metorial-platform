package service

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/gorilla/websocket"
	"github.com/metorial/metorial/services/listener/gen/rpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type SendToListenersRequest struct {
	Payload            string `json:"payload"`
	Id                 string `json:"id"`
	ListenerIdentifier string `json:"listener_identifier"`
}

type SendToListenersResponse struct {
	Success   bool      `json:"success"`
	Response  string    `json:"response"`
	Timestamp time.Time `json:"timestamp"`
	Error     string    `json:"error,omitempty"`
}

type Listener struct {
	ID         string
	Conn       *websocket.Conn
	ResponseCh chan InternalResponse
	mu         sync.Mutex
}

type PendingMessage struct {
	MessageID   string
	ResponseCh  chan InternalResponse
	CancelFunc  context.CancelFunc
	RequestTime time.Time
}

type ScalableListenerConnectorService struct {
	rpc.UnimplementedListenerConnectorServer

	config      *Config
	listeners   map[string]*Listener
	pending     map[string]*PendingMessage
	listenersMu sync.RWMutex
	pendingMu   sync.RWMutex
	redisClient *redis.Client
	pubsub      *redis.PubSub
}

func (s *ScalableListenerConnectorService) handleInternalResponse(ctx context.Context, payload string) {
	var response InternalResponse
	if err := json.Unmarshal([]byte(payload), &response); err != nil {
		log.Printf("Failed to unmarshal internal response: %v", err)
		return
	}

	s.pendingMu.RLock()
	pending, exists := s.pending[response.MessageID]
	s.pendingMu.RUnlock()

	if exists && pending != nil {
		select {
		case pending.ResponseCh <- response:
		default:
			// Channel is full or closed
		}
	}
}

func (s *ScalableListenerConnectorService) sendToLocalListener(ctx context.Context, listener *Listener, req *SendToListenersRequest, messageID string) (*SendToListenersResponse, error) {
	wsMsg := WebSocketMessage{
		ID:      messageID,
		Payload: req.Payload,
	}

	msgBytes, err := json.Marshal(wsMsg)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to marshal message: %v", err)
	}

	listener.mu.Lock()
	err = listener.Conn.WriteMessage(websocket.TextMessage, msgBytes)
	listener.mu.Unlock()

	if err != nil {
		s.removeListener(req.ListenerIdentifier)
		return nil, status.Errorf(codes.Unavailable, "failed to send message to listener: %v", err)
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	select {
	case response := <-listener.ResponseCh:
		return &SendToListenersResponse{
			Success:   response.Success,
			Response:  response.Response,
			Timestamp: time.Now(),
		}, nil
	case <-ctx.Done():
		return nil, status.Errorf(codes.DeadlineExceeded, "timeout waiting for listener response")
	}
}

func (s *ScalableListenerConnectorService) sendErrorResponse(messageID, errorMsg string) {
	response := InternalResponse{
		MessageID:        messageID,
		Success:          false,
		Error:            errorMsg,
		SourceInstanceID: s.config.InstanceID,
	}

	responseBytes, err := json.Marshal(response)
	if err != nil {
		log.Printf("Failed to marshal error response: %v", err)
		return
	}

	ctx := context.Background()
	s.redisClient.Publish(ctx, "listener_responses", responseBytes)
}

func (s *ScalableListenerConnectorService) addListener(id string, conn *websocket.Conn) {
	s.listenersMu.Lock()
	defer s.listenersMu.Unlock()

	if existingListener, exists := s.listeners[id]; exists {
		existingListener.Conn.Close()
	}

	listener := &Listener{
		ID:         id,
		Conn:       conn,
		ResponseCh: make(chan InternalResponse, 1),
	}

	s.listeners[id] = listener
	s.registerListener(id)

	log.Printf("Listener %s connected to instance %s", id, s.config.InstanceID)
}

func (s *ScalableListenerConnectorService) removeListener(id string) {
	s.listenersMu.Lock()
	defer s.listenersMu.Unlock()

	if listener, exists := s.listeners[id]; exists {
		listener.Conn.Close()
		close(listener.ResponseCh)
		delete(s.listeners, id)
		s.unregisterListener(id)
		log.Printf("Listener %s disconnected from instance %s", id, s.config.InstanceID)
	}
}
