package mongoStore

import (
	"context"
	"fmt"
	"log"

	"github.com/metorial/metorial/services/usage/internal/repository"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type MongoStore struct {
	repository.UsageStore

	client     *mongo.Client
	database   *mongo.Database
	collection *mongo.Collection
}

func NewMongoStore(ctx context.Context, mongoURL, dbName, collectionName string) (*MongoStore, error) {
	clientOptions := options.Client().ApplyURI(mongoURL)
	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to MongoDB: %w", err)
	}

	err = client.Ping(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to ping MongoDB: %w", err)
	}

	database := client.Database(dbName)
	collection := database.Collection(collectionName)

	err = createIndexes(ctx, collection)
	if err != nil {
		return nil, fmt.Errorf("failed to create indexes: %w", err)
	}

	log.Println("Connected to MongoDB successfully")

	return &MongoStore{
		client:     client,
		database:   database,
		collection: collection,
	}, nil
}

func (m *MongoStore) Close(ctx context.Context) error {
	if m.client != nil {
		return m.client.Disconnect(ctx)
	}
	return nil
}
