package store

import (
	"context"
	"fmt"
	"log"
	"math/rand/v2"
	"time"

	memoryQueue "github.com/metorial/metorial/modules/memory-queue"
	"go.mongodb.org/mongo-driver/bson"
)

func (s *LogStore) cleanup() error {
	now := time.Now()
	duration := s.entryType.GetCleanupDuration()
	if duration <= 0 {
		log.Printf("No cleanup duration set for entry type %s, skipping cleanup", s.entryType.GetTypeName())
		return nil
	}

	cutoff := now.Add(-duration)

	filter := bson.M{
		"timestamp": bson.M{
			"$lt": cutoff.UnixMilli(),
		},
	}

	cursor, err := s.collection.Find(context.Background(), filter)
	if err != nil {
		return fmt.Errorf("failed to find old logs: %w", err)
	}
	defer cursor.Close(context.Background())

	queue := memoryQueue.NewBlockingJobQueue(25)
	defer queue.Stop()

	for cursor.Next(context.Background()) {
		doc := &LogDocument{}
		if err := cursor.Decode(doc); err != nil {
			return fmt.Errorf("failed to decode log document: %w", err)
		}

		queue.AddAndBlockIfFull(func() error {
			err := s.storageBackend.Delete(doc.PayloadKey)
			if err != nil {
				return err
			}

			_, err = s.collection.DeleteOne(context.Background(), bson.M{"_id": doc.ID})
			if err != nil {
				return fmt.Errorf("failed to delete log document: %w", err)
			}

			return nil
		})
	}

	queue.Wait()

	if err := cursor.Err(); err != nil {
		return fmt.Errorf("cursor error: %w", err)
	}

	return nil
}

func (s *LogStore) startCleanupRoutine() {
	duration := time.Duration(rand.IntN(20)+10) * time.Minute // Random duration between 10 and 30 minutes

	go func() {
		ticker := time.NewTicker(duration)
		defer ticker.Stop()

		for range ticker.C {
			if err := s.cleanup(); err != nil {
				log.Printf("Error during cleanup: %v", err)
			}
		}
	}()
}
