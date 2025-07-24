package queues

import (
	"github.com/metorial/metorial/modules/queue"
	"github.com/metorial/metorial/services/hook/gen/hook"
	"github.com/metorial/metorial/services/hook/internal/db"
)

type Queues struct {
	manager *queue.QueueManager
	db      *db.DB

	createDeliveryIntentQueue  *queue.Queue[CreateDeliveryIntentQueuePayload]
	createDeliveryIntentsQueue *queue.Queue[CreateDeliveryIntentsQueuePayload]
	ingestEventQueue           *queue.Queue[hook.CreateEventRequest]
	attemptDeliveryQueue       *queue.Queue[AttemptDeliveryQueuePayload]
}

func NewQueues(uri string) *Queues {
	manager, err := queue.NewQueueManager(uri)
	if err != nil {
		panic(err) // Handle error appropriately in production code
	}

	return &Queues{
		manager: manager,
	}
}
