package payload

import "github.com/metorial/metorial/services/hook/internal/db"

func GetWebhookPayload(event *db.Event, destination *db.EventDestination) map[string]any {
	payload := map[string]any{
		"event_id":       event.ID,
		"event_type":     event.EventType,
		"destination_id": destination.ID,
	}

	if destination.Webhook != nil {
		payload["webhook_id"] = destination.Webhook.ID
	}

	return payload
}
