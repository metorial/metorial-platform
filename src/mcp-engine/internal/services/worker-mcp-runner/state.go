package worker_mcp_runner

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/metorial/metorial/mcp-engine/pkg/docker"
	"github.com/metorial/metorial/modules/util"
)

type RunnerState struct {
	RunnerID  string
	StartTime time.Time

	dockerManager *docker.DockerManager

	active_runs map[string]*Run
	total_runs  uint64

	mutex sync.RWMutex
	done  <-chan struct{}
}

func newRunnerState(dockerManager *docker.DockerManager, done <-chan struct{}) *RunnerState {
	return &RunnerState{
		RunnerID:  util.Must(uuid.NewV7()).String(),
		StartTime: time.Now(),

		dockerManager: dockerManager,
		active_runs:   make(map[string]*Run),
		total_runs:    0,
		done:          done,
	}
}

func (state *RunnerState) addRun(run *Run) {
	state.mutex.Lock()
	defer state.mutex.Unlock()

	if state.active_runs == nil {
		state.active_runs = make(map[string]*Run)
	}

	state.active_runs[run.ID] = run
	state.total_runs++
}

func (state *RunnerState) removeRun(runID string) {
	state.mutex.Lock()
	defer state.mutex.Unlock()

	if state.active_runs == nil {
		return
	}

	delete(state.active_runs, runID)
}

func (state *RunnerState) StartRun(init *RunInit) (*Run, error) {
	run, err := newRun(state, init)
	if err != nil {
		log.Printf("Failed to start run: %v", err)
		return nil, fmt.Errorf("failed to start run: %w", err)
	}

	state.addRun(run)

	return run, nil
}

func (state *RunnerState) StopRun(runID string) error {
	state.mutex.RLock()
	defer state.mutex.RUnlock()

	run, exists := state.active_runs[runID]
	if !exists {
		return nil // Run not found, nothing to stop
	}

	err := run.Stop()

	// Remove the run, even if stopping failed
	state.removeRun(runID)

	return err
}

func (state *RunnerState) ListActiveRuns() []*Run {
	state.mutex.RLock()
	defer state.mutex.RUnlock()

	runs := make([]*Run, 0, len(state.active_runs))
	for _, run := range state.active_runs {
		runs = append(runs, run)
	}
	return runs
}

func (state *RunnerState) printState() {
	state.mutex.RLock()
	defer state.mutex.RUnlock()

	log.Println("\n== Runner State ==")

	log.Println("Total Runs:", state.total_runs)
	log.Println("Active Runs:", len(state.active_runs))
}

func (state *RunnerState) startPrintStateRoutine(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-ticker.C:
				state.printState()
			case <-state.done:
				return
			}
		}
	}()
}
