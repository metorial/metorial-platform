package queues

import (
	"context"

	"github.com/metorial/metorial/modules/queue"
)

type CreateDeliveryIntentsQueuePayload struct {
	InstanceID string
	EventType  string
	EventId    string
}

func (q *Queues) newCreateDeliveryIntentsQueue() *queue.Queue[CreateDeliveryIntentsQueuePayload] {
	return queue.CreateQueue[CreateDeliveryIntentsQueuePayload](
		q.manager,
		"whk/create_intents",
		func(ctx context.Context, job *queue.Job[CreateDeliveryIntentsQueuePayload]) error {
			destinations, err := q.db.GetAllEventDestinationsByInstanceIdAndEventType(
				job.Data.InstanceID,
				job.Data.EventType,
			)
			if err != nil {
				return err
			}

			for _, destination := range destinations {
				return q.createDeliveryIntentQueue.Enqueue(ctx, CreateDeliveryIntentQueuePayload{
					EventId:       job.Data.EventId,
					DestinationId: destination.ID,
				})
			}

			return nil
		},
	)
}
