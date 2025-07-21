package queues

import (
	"context"

	"github.com/metorial/metorial/modules/queue"
)

type AttemptDeliveryQueuePayload struct {
	EventId       string
	DestinationId string
	IntentId      string
}

func (q *Queues) newAttemptDeliveryQueue() *queue.Queue[AttemptDeliveryQueuePayload] {
	return queue.CreateQueue[AttemptDeliveryQueuePayload](
		q.manager,
		"whk/attempt_delivery",
		func(ctx context.Context, job *queue.Job[AttemptDeliveryQueuePayload]) error {
			intent, err := q.db.GetEventDeliveryIntentByID()
		},
	)
}
