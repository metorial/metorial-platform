package queues

import (
	"context"
	"fmt"

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
			intent, err := q.db.GetEventDeliveryIntentByID(job.Data.IntentId)
			if err != nil {
				return err
			}

			event := intent.Event
			destination := intent.Destination
			if destination == nil || event == nil {
				return fmt.Errorf("intent %s has no event or destination", job.Data.IntentId)
			}

			if destination.Webhook != nil {

			}

			return nil
		},
	)
}
