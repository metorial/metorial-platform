package docker

import (
	"strings"
	"time"
)

type DockerTime struct {
	time.Time
}

const dockerTimeLayout = "2006-01-02 15:04:05 -0700 MST"

func (ct *DockerTime) UnmarshalJSON(b []byte) error {
	s := strings.Trim(string(b), `"`)
	t, err := time.Parse(dockerTimeLayout, s)
	if err != nil {
		return err
	}
	ct.Time = t
	return nil
}
