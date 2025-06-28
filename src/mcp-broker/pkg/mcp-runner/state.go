package mcp_runner

import (
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/metorial/metorial/mcp-broker/pkg/docker"
	mterror "github.com/metorial/metorial/mcp-broker/pkg/mt-error"
)

type RunnerState struct {
	RunnerID  string
	StartTime time.Time

	health        *RunnerHealthManager
	dockerManager *docker.DockerManager

	active_runs map[string]*Run
	total_runs  uint64

	mutex sync.Mutex
	done  chan struct{}
}

func newRunnerState(dockerManager *docker.DockerManager, done chan struct{}) *RunnerState {
	return &RunnerState{

		RunnerID:  uuid.New().String(),
		StartTime: time.Now(),

		health: NewRunnerHealthManager(),

		dockerManager: dockerManager,
		active_runs:   make(map[string]*Run),
		total_runs:    0,
		done:          done,
		mutex:         sync.Mutex{},
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
		return nil, mterror.WithInnerError("failed_to_start", "Failed to start run", err, map[string]any{})
	}

	state.addRun(run)

	return run, nil
}

func (state *RunnerState) StopRun(runID string) error {
	run, exists := state.active_runs[runID]
	if !exists {
		return nil // Run not found, nothing to stop
	}

	run.Stop()
	state.removeRun(runID)

	return nil
}

func (state *RunnerState) ListActiveRuns() []*Run {
	runs := make([]*Run, 0, len(state.active_runs))
	for _, run := range state.active_runs {
		runs = append(runs, run)
	}
	return runs
}

func (state *RunnerState) printState() {
	state.mutex.Lock()
	defer state.mutex.Unlock()

	fmt.Println("\n== Runner State ==")

	fmt.Println("Health - Healthy:", state.health.Health.healthy)
	fmt.Println("Health - Accepting Runs:", state.health.Health.acceptingRuns)
	fmt.Println("Total Runs:", state.total_runs)
	fmt.Println("Active Runs:", len(state.active_runs))
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
