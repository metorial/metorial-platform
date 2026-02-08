package mongoStore

import (
	"context"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func createIndexes(ctx context.Context, collection *mongo.Collection) error {
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
