package service

import (
	"context"
	"log"
	"net"

	grpc_util "github.com/metorial/metorial/mcp-engine/pkg/grpcUtil"
	"github.com/metorial/metorial/services/log/gen/rpc"
	"github.com/metorial/metorial/services/log/internal/entries"
	"github.com/metorial/metorial/services/log/internal/s3"
	"github.com/metorial/metorial/services/log/internal/store"
	"google.golang.org/grpc/reflection"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type LogService struct {
	entryRegistry *entries.EntryTypeRegistry
	storeRegistry *store.StoreTypeRegistry

	mongoClient *mongo.Client

	config *Config
}

func NewService(ctx context.Context, entryRegistry *entries.EntryTypeRegistry, opts ...ConfigOptions) *LogService {
	config := applyConfigOptions(opts...)

	mongoClient, err := mongo.Connect(ctx, options.Client().ApplyURI(config.MongoURI))
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}

	db := mongoClient.Database(config.MongoDatabase)

	// Initialize S3 storage
	storage, err := s3.NewS3StorageBackend(config.ToS3Config())
	if err != nil {
		log.Fatalf("Failed to initialize S3 storage: %v", err)
	}

	storeRegistry := store.NewStoreTypeRegistry(entryRegistry, storage, db)

	return &LogService{
		entryRegistry: entryRegistry,
		storeRegistry: storeRegistry,
		mongoClient:   mongoClient,
		config:        config,
	}
}

func (s *LogService) Start() {
	config := s.config

	lis, err := net.Listen("tcp", config.GRPCAddress)
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	rpcService := newRcpService(s)

	grpcServer := grpc_util.NewGrpcServer("listener")
	rpc.RegisterLogServiceServer(grpcServer, rpcService)

	reflection.Register(grpcServer)
	log.Printf("gRPC server starting on %s", config.GRPCAddress)

	go func() {
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("Failed to serve: %v", err)
		}
	}()
}

func (s *LogService) Stop() {
	s.storeRegistry.Stop()

	if err := s.mongoClient.Disconnect(context.Background()); err != nil {
		log.Printf("Failed to disconnect MongoDB client: %v", err)
	}

	log.Println("Log service stopped")
}
