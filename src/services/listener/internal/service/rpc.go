package service

import (
	"context"
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"github.com/metorial/metorial/services/listener/gen/rpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

func (s *ListenerConnectorService) SendToListeners(ctx context.Context, req *rpc.SendToListenersRequest) (*rpc.SendToListenersResponse, error) {
	messageID := req.Id
	if messageID == "" {
		messageID = uuid.New().String()
	}

	// Check if listener is connected to this instance first
	s.listenersMu.RLock()
	localListener, hasLocal := s.listeners[req.ListenerIdentifier]
	s.listenersMu.RUnlock()

	if hasLocal {
		// Send directly to local listener
		res, err := s.sendToLocalListener(ctx, localListener, &SendToListenersRequest{
			Payload:            req.Payload,
			Id:                 messageID,
			ListenerIdentifier: req.ListenerIdentifier,
		}, messageID)
		if err != nil {
			return nil, status.Errorf(codes.Internal, "failed to send to local listener: %v", err)
		}

		return &rpc.SendToListenersResponse{
			Success:   res.Success,
			Response:  res.Response,
			Timestamp: time.Now().Unix(),
			Error:     res.Error,
		}, nil

	}

	listenerInstanceID, err := s.findListenerInstance(ctx, req.ListenerIdentifier)
	if err != nil || listenerInstanceID == "" {
		return nil, status.Errorf(codes.NotFound, "listener %s not found", req.ListenerIdentifier)
	}

	responseCh := make(chan InternalResponse, 1)
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)

	pending := &PendingMessage{
		MessageID:   messageID,
		ResponseCh:  responseCh,
		CancelFunc:  cancel,
		RequestTime: time.Now(),
	}

	s.pendingMu.Lock()
	s.pending[messageID] = pending
	s.pendingMu.Unlock()

	defer func() {
		s.pendingMu.Lock()
		delete(s.pending, messageID)
		s.pendingMu.Unlock()
		cancel()
		close(responseCh)
	}()

	// Send message via Redis to the instance that has the listener
	internalMsg := InternalMessage{
		MessageID:          messageID,
		ListenerIdentifier: req.ListenerIdentifier,
		Payload:            req.Payload,
		SourceInstanceID:   s.config.InstanceID,
		Timestamp:          time.Now(),
	}

	msgBytes, err := json.Marshal(internalMsg)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to marshal internal message: %v", err)
	}

	err = s.redisClient.Publish(ctx, "listener_messages", msgBytes).Err()
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to publish message: %v", err)
	}

	// Wait for response
	select {
	case response := <-responseCh:
		if !response.Success {
			return nil, status.Errorf(codes.Internal, "listener error: %s", response.Error)
		}
		return &rpc.SendToListenersResponse{
			Success:   true,
			Response:  response.Response,
			Timestamp: time.Now().Unix(),
		}, nil
	case <-ctx.Done():
		return nil, status.Errorf(codes.DeadlineExceeded, "timeout waiting for listener response")
	}
}

func (rs *ListenerConnectorService) GetListenerToken(ctx context.Context, req *rpc.GetListenerTokenRequest) (*rpc.GetListenerTokenResponse, error) {
	if req.ListenerIdentifier == "" {
		return nil, status.Errorf(codes.InvalidArgument, "listener identifier is required")
	}

	if req.ExpiresInSeconds <= 0 {
		return nil, status.Errorf(codes.InvalidArgument, "expires in seconds must be greater than zero")
	}

	token, err := rs.createJWT(req.ListenerIdentifier, time.Duration(req.ExpiresInSeconds)*time.Second)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate listener token: %v", err)
	}

	return &rpc.GetListenerTokenResponse{
		Token: token,
	}, nil
}
