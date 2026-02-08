package store

import (
	"context"
	"fmt"
	"time"

	memoryQueue "github.com/metorial/metorial/modules/memory-queue"
	"github.com/metorial/metorial/services/log/internal/entries"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type LogStore struct {
	entryType      entries.EntryType
	collection     *mongo.Collection
	storageBackend StorageBackend

	queue *memoryQueue.JobQueue
}

func NewLogStore(entryType entries.EntryType, storageBackend StorageBackend, db *mongo.Database) *LogStore {
	collection := db.Collection(fmt.Sprintf("logs_%s", entryType.GetTypeName()))

	indexes := []mongo.IndexModel{
		{
			Keys: bson.D{
				{Key: "entity_type", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "entity_id", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "instance_id", Value: 1},
			},
		},
		{
			Keys: bson.D{
				{Key: "timestamp", Value: -1},
			},
		},
	}

	filterFields := entryType.GetFilterFields()
	if len(filterFields) > 0 {
		for _, field := range filterFields {
			indexes = append(indexes, mongo.IndexModel{
				Keys: bson.D{
					{Key: fmt.Sprintf("fields.%s", field.Name), Value: 1},
				},
			})
		}
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	collection.Indexes().CreateMany(ctx, indexes)

	res := &LogStore{
		collection:     collection,
		entryType:      entryType,
		storageBackend: storageBackend,

		queue: memoryQueue.NewJobQueue(50),
	}

	res.startCleanupRoutine()

	return res
}
