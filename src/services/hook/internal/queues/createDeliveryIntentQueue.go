package queues

import (
	"context"

	"github.com/metorial/metorial/modules/queue"
	"github.com/metorial/metorial/services/hook/internal/db"
)

type CreateDeliveryIntentQueuePayload struct {
	EventId       string
	DestinationId string
}

func (q *Queues) newCreateDeliveryIntentQueue() *queue.Queue[CreateDeliveryIntentQueuePayload] {
	return queue.CreateQueue[CreateDeliveryIntentQueuePayload](
		q.manager,
		"whk/create_intent",
		func(ctx context.Context, job *queue.Job[CreateDeliveryIntentQueuePayload]) error {
			intent, err := q.db.CreateEventDeliveryIntent(db.NewEventDeliveryIntentLight(
				job.Data.EventId,
				job.Data.DestinationId,
			))
			if err != nil {
				return err
			}

			q.attemptDeliveryQueue.Enqueue(ctx, AttemptDeliveryQueuePayload{
				EventId:       job.Data.EventId,
				DestinationId: job.Data.DestinationId,
				IntentId:      intent.ID,
			})

			return nil
		},
	)
}
