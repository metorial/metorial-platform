package service

import (
	"log"
	"net"
	"net/http"

	"github.com/go-redis/redis/v8"
	grpc_util "github.com/metorial/metorial/mcp-engine/pkg/grpcUtil"
	"github.com/metorial/metorial/modules/util"
	"github.com/metorial/metorial/services/listener/gen/rpc"
	"google.golang.org/grpc/reflection"
)

func NewService(opts ...ConfigOptions) *ListenerConnectorService {
	config := applyConfigOptions(opts...)

	rdb := redis.NewClient(util.Must(redis.ParseURL(config.RedisURL)))

	service := &ListenerConnectorService{
		config:      config,
		listeners:   make(map[string]*Listener),
		pending:     make(map[string]*PendingMessage),
		redisClient: rdb,
	}

	service.setupRedisSubscriptions()

	service.registerInstance()

	go service.cleanupExpiredMessages()

	return service
}

func (s *ListenerConnectorService) Start() {
	config := s.config

	http.HandleFunc("/ws", s.handleWebSocket)
	go func() {
		log.Printf("WebSocket server starting on %s (instance: %s)", config.WebSocketAddress, config.InstanceID)
		if err := http.ListenAndServe(config.WebSocketAddress, nil); err != nil {
			log.Fatalf("WebSocket server failed: %v", err)
		}
	}()

	lis, err := net.Listen("tcp", config.GRPCAddress)
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	grpcServer := grpc_util.NewGrpcServer("listener")
	rpc.RegisterListenerConnectorServer(grpcServer, s)

	reflection.Register(grpcServer)
	log.Printf("gRPC server starting on %s (instance: %s)", config.GRPCAddress, config.InstanceID)

	go func() {
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("Failed to serve: %v", err)
		}
	}()
}
