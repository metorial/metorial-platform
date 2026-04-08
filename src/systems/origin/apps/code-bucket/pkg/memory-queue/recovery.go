package memoryQueue

import "fmt"

func runJobWithRecovery(job JobFunc) (err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("job panicked: %v", r)
		}
	}()

	return job()
}
