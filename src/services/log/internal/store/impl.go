package store

import (
	"context"
	"fmt"
	"slices"

	"github.com/metorial/metorial/services/log/gen/rpc"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

type LogFilter struct {
	EntityType   string
	EntityIds    []string
	InstanceIds  []string
	FilterJson   *string
	Pagination   *rpc.ListPagination
	TimestampMin *uint64
	TimestampMax *uint64
}

type LogDocument struct {
	ID         primitive.ObjectID `bson:"_id,omitempty"`
	EntityID   string             `bson:"entity_id"`
	EntityType string             `bson:"entity_type"`
	InstanceID string             `bson:"instance_id"`
	Timestamp  uint64             `bson:"timestamp"`
	PayloadKey string             `bson:"payload_key"`
	Fields     map[string]any     `bson:"fields"`
}

func (s *LogStore) IngestLog(
	ctx context.Context,
	instanceId string,
	entryId string,
	payloadJson string,
	timestamp uint64,
) error {
	instance, err := s.entryType.ParsePayload(payloadJson)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "failed to parse payload: %v", err)
	}

	fields, err := instance.ExtractLightRecord()
	if err != nil {
		return status.Errorf(codes.Internal, "failed to extract fields: %v", err)
	}

	s.queue.Add(func() error {
		payloadKey := fmt.Sprintf("%s/%s/%s", s.entryType.GetTypeName(), instanceId, entryId)

		if err := s.storageBackend.Store(payloadKey, []byte(payloadJson)); err != nil {
			return err
		}

		doc := &LogDocument{
			EntityID:   entryId,
			EntityType: s.entryType.GetTypeName(),
			InstanceID: instanceId,
			Timestamp:  timestamp,
			PayloadKey: payloadKey,
			Fields:     fields,
		}

		if _, err := s.collection.InsertOne(context.Background(), doc); err != nil {
			fmt.Printf("Failed to insert log document: %v\n", err)
			return err
		}

		return nil
	}, 10)

	return nil
}

func (s *LogStore) ListLogs(ctx context.Context, req *LogFilter) ([]*LogDocument, error) {
	// Build query filters
	filters := bson.M{}

	if req.EntityType != "" {
		filters["entity_type"] = req.EntityType
	}

	if len(req.EntityIds) > 0 {
		filters["entity_id"] = bson.M{"$in": req.EntityIds}
	}

	if len(req.InstanceIds) > 0 {
		filters["instance_id"] = bson.M{"$in": req.InstanceIds}
	}

	if req.FilterJson != nil {
		var filterMap map[string]any
		if err := bson.UnmarshalExtJSON([]byte(*req.FilterJson), true, &filterMap); err != nil {
			return nil, status.Errorf(codes.InvalidArgument, "failed to parse filter JSON: %v", err)
		}
		for key, value := range filterMap {
			filters[fmt.Sprintf("fields.%s", key)] = value
		}
	}

	if req.TimestampMin != nil {
		filters["timestamp"] = bson.M{"$gte": *req.TimestampMin}
	}
	if req.TimestampMax != nil {
		filters["timestamp"] = bson.M{"$lte": *req.TimestampMax}
	}

	opts := options.Find()
	opts.SetSort(bson.D{{Key: "entity_id", Value: -1}}) // Default to descending order
	opts.SetLimit(100)                                  // Default limit

	mustReverse := false

	// Apply pagination if provided
	if req.Pagination != nil {
		if req.Pagination.Limit > 0 {
			opts.SetLimit(int64(req.Pagination.Limit))
		}

		if req.Pagination.AfterId != "" {
			objID, err := primitive.ObjectIDFromHex(req.Pagination.AfterId)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid after_id: %v", err)
			}
			filters["entity_id"] = bson.M{"$gt": objID}

			if req.Pagination.Order == rpc.ListPaginationOrder_list_cursor_order_asc {
				opts.SetSort(bson.D{{Key: "entity_id", Value: 1}})
			} else {
				opts.SetSort(bson.D{{Key: "entity_id", Value: -1}})
			}
		}

		if req.Pagination.BeforeId != "" {
			objID, err := primitive.ObjectIDFromHex(req.Pagination.BeforeId)
			if err != nil {
				return nil, status.Errorf(codes.InvalidArgument, "invalid before_id: %v", err)
			}
			filters["entity_id"] = bson.M{"$lt": objID}

			if req.Pagination.Order == rpc.ListPaginationOrder_list_cursor_order_asc {
				opts.SetSort(bson.D{{Key: "entity_id", Value: -1}})
			} else {
				opts.SetSort(bson.D{{Key: "entity_id", Value: 1}})
			}

			mustReverse = true
		}
	}

	cursor, err := s.collection.Find(ctx, filters, opts)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to query logs: %v", err)
	}
	defer cursor.Close(ctx)

	var results []*LogDocument
	if err = cursor.All(ctx, &results); err != nil {
		return nil, status.Errorf(codes.Internal, "failed to decode logs: %v", err)
	}

	if mustReverse {
		// Reverse the order if pagination requires it
		slices.Reverse(results)
	}

	return results, nil
}

func (s *LogStore) GetLog(ctx context.Context, entityId string, instanceId *string) (*LogDocument, *string, error) {
	filters := bson.M{
		"entity_id":   entityId,
		"entity_type": s.entryType.GetTypeName(),
	}

	if instanceId != nil {
		filters["instance_id"] = *instanceId
	}

	var doc LogDocument
	err := s.collection.FindOne(ctx, filters).Decode(&doc)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil, status.Errorf(codes.NotFound, "log not found")
		}
		return nil, nil, status.Errorf(codes.Internal, "failed to query log: %v", err)
	}

	// Retrieve payload from S3
	payload, err := s.storageBackend.Retrieve(doc.PayloadKey)
	if err != nil {
		return nil, nil, status.Errorf(codes.Internal, "failed to retrieve payload: %v", err)
	}

	stringPayload := string(payload)

	return &doc, &stringPayload, nil
}
