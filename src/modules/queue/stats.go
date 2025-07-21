package queue

import (
	"context"
	"fmt"
)

type QueueStats struct {
	QueueName  string `json:"queue_name"`
	Pending    int64  `json:"pending"`
	Processing int64  `json:"processing"`
	Failed     int64  `json:"failed"`
}

func (q *Queue[_]) GetQueueStats(ctx context.Context) (*QueueStats, error) {
	pipe := q.client.Pipeline()
	pendingCmd := pipe.ZCard(ctx, q.pendingKey())
	processingCmd := pipe.ZCard(ctx, q.processingKey())
	failedCmd := pipe.LLen(ctx, q.failedKey())

	_, err := pipe.Exec(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get queue stats: %w", err)
	}

	return &QueueStats{
		QueueName:  q.name,
		Pending:    pendingCmd.Val(),
		Processing: processingCmd.Val(),
		Failed:     failedCmd.Val(),
	}, nil
}
