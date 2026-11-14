package memoryQueue

import (
	"math"
	"time"
)

func randFloat64() float64 {
	return float64(time.Now().UnixNano()%1000) / 1000
}

func defaultBackoff(retry int) time.Duration {
	base := time.Millisecond * 100
	factor := math.Pow(2, float64(retry-1))
	backoff := time.Duration(factor) * base
	jitter := time.Duration(float64(backoff) * (0.5 + 0.5*randFloat64()))
	return backoff + jitter
}
