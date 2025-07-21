package queues

import (
	"context"

	"github.com/metorial/metorial/modules/queue"
	"github.com/metorial/metorial/services/hook/gen/hook"
	"github.com/metorial/metorial/services/hook/internal/db"
)

func (q *Queues) newIngestEventQueue() *queue.Queue[hook.CreateEventRequest] {
	return queue.CreateQueue[hook.CreateEventRequest](
		q.manager,
		"whk/ingest_event",
		func(ctx context.Context, job *queue.Job[hook.CreateEventRequest]) error {
			event, err := q.db.CreateEvent(db.NewEvent(job.Data.InstanceId, job.Data.EventType, job.Data.Payload))
			if err != nil {
				return err
			}

			return q.createDeliveryIntentsQueue.Enqueue(ctx, CreateDeliveryIntentsQueuePayload{
				InstanceID: event.InstanceID,
				EventType:  event.EventType,
				EventId:    event.ID,
			})
		},
	)
}
