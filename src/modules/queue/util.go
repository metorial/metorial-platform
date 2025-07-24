package queue

import (
	"encoding/json"
	"fmt"
	"math/rand"
	"time"

	"github.com/metorial/metorial/modules/util"
)

func generateJobID() string {
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), rand.Intn(10000))
}

func mustMarshal(v interface{}) []byte {
	return util.Must(json.Marshal(v))
}
