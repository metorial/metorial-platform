package db

import (
	"context"
	"log"
	"sync"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

var (
	client     *mongo.Client
	database   *mongo.Database
	collection *mongo.Collection
	once       sync.Once

	// Local cache for batching usage records
	usageCache = make(map[string]*UsageRecord)
	cacheMutex sync.RWMutex

	// Batch processing ticker
	batchTicker *time.Ticker
)

type UsageRecord struct {
	ID         primitive.ObjectID `bson:"_id,omitempty" json:"id"`
	OwnerID    string             `bson:"ownerId" json:"ownerId"`
	EntityID   string             `bson:"entityId" json:"entityId"`
	EntityType string             `bson:"entityType" json:"entityType"`
	Count      int64              `bson:"count" json:"count"`
	Type       string             `bson:"type" json:"type"`
	Timestamp  time.Time          `bson:"ts" json:"ts"`
}

type TimelineOptions struct {
	OwnerIDs    []string
	EntityTypes []string
	EntityIDs   []string
	From        time.Time
	To          time.Time
	Interval    IntervalConfig
}

type IntervalConfigUnit string

const (
	IntervalUnitHour   IntervalConfigUnit = "hour"
	IntervalUnitMinute IntervalConfigUnit = "minute"
	IntervalUnitDay    IntervalConfigUnit = "day"
)

type IntervalConfig struct {
	Unit  IntervalConfigUnit
	Count int32
}

type TimelineEntry struct {
	Timestamp time.Time `json:"ts"`
	Count     int64     `json:"count"`
}

type TimelineSeries struct {
	EntityID   string          `json:"entityId"`
	EntityType string          `json:"entityType"`
	OwnerID    string          `json:"ownerId"`
	Entries    []TimelineEntry `json:"entries"`
}

func Connect(ctx context.Context, mongoURL string) error {
	if mongoURL == "" {
		return nil // Usage tracking disabled
	}

	var err error
	once.Do(func() {
		clientOptions := options.Client().ApplyURI(mongoURL)
		client, err = mongo.Connect(ctx, clientOptions)
		if err != nil {
			log.Printf("Failed to connect to MongoDB: %v", err)
			return
		}

		err = client.Ping(ctx, nil)
		if err != nil {
			log.Printf("Failed to ping MongoDB: %v", err)
			return
		}

		database = client.Database("usage")
		collection = database.Collection("usage_records")

		err = createIndexes(ctx)
		if err != nil {
			log.Printf("Failed to create indexes: %v", err)
			return
		}

		startBatchProcessor()

		log.Println("Connected to MongoDB successfully")
	})

	return err
}

func createIndexes(ctx context.Context) error {
	indexes := []mongo.IndexModel{
		{
			Keys: bson.D{{Key: "entityId", Value: 1}},
		},
		{
			Keys:    bson.D{{Key: "ts", Value: 1}},
			Options: options.Index().SetExpireAfterSeconds(60 * 60 * 24 * 30), // 30 days TTL
		},
		{
			Keys: bson.D{
				{Key: "ownerId", Value: 1},
				{Key: "entityId", Value: 1},
				{Key: "entityType", Value: 1},
				{Key: "type", Value: 1},
			},
		},
	}

	_, err := collection.Indexes().CreateMany(ctx, indexes)
	return err
}

func IsEnabled() bool {
	return client != nil
}

func Close(ctx context.Context) error {
	if batchTicker != nil {
		batchTicker.Stop()
	}

	// Process remaining batch before closing
	processBatch()

	if client != nil {
		return client.Disconnect(ctx)
	}
	return nil
}
