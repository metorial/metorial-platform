package gc

import (
	"context"
	"log/slog"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/tools/leaderelection"
	"k8s.io/client-go/tools/leaderelection/resourcelock"
)

type Target interface {
	Candidates() ([]Candidate, error)
	Evict(ctx context.Context, c Candidate, reason Reason) error
}

type Sweeper func(ctx context.Context) error

type Collector struct {
	Target   Target
	Sweepers []Sweeper
	Policy   Policy
	Interval time.Duration
	Log      *slog.Logger
	Now      func() time.Time
}

// RunOnce performs one GC pass and returns what it evicted.
func (c *Collector) RunOnce(ctx context.Context) ([]Eviction, error) {
	candidates, err := c.Target.Candidates()
	if err != nil {
		return nil, err
	}

	var done []Eviction
	for _, e := range Decide(c.Now(), candidates, c.Policy) {
		if err := c.Target.Evict(ctx, e.Candidate, e.Reason); err != nil {
			c.Log.Warn("gc eviction failed", "name", e.Candidate.Name, "reason", e.Reason, "error", err)
			continue
		}
		done = append(done, e)
	}

	for _, sweep := range c.Sweepers {
		if err := sweep(ctx); err != nil {
			c.Log.Warn("gc sweep failed", "error", err)
		}
	}
	return done, nil
}

func (c *Collector) loop(ctx context.Context) {
	ticker := time.NewTicker(c.Interval)
	defer ticker.Stop()

	for {
		if _, err := c.RunOnce(ctx); err != nil {
			c.Log.Warn("gc pass failed", "error", err)
		}
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
		}
	}
}

// Run collects garbage while this replica holds the GC Lease, and keeps competing for it until
// ctx is cancelled.
func (c *Collector) Run(ctx context.Context, client kubernetes.Interface, namespace, leaseName, identity string) {
	lock := &resourcelock.LeaseLock{
		LeaseMeta:  metav1.ObjectMeta{Name: leaseName, Namespace: namespace},
		Client:     client.CoordinationV1(),
		LockConfig: resourcelock.ResourceLockConfig{Identity: identity},
	}

	for ctx.Err() == nil {
		leaderelection.RunOrDie(ctx, leaderelection.LeaderElectionConfig{
			Lock:            lock,
			LeaseDuration:   30 * time.Second,
			RenewDeadline:   20 * time.Second,
			RetryPeriod:     5 * time.Second,
			ReleaseOnCancel: true,
			Name:            leaseName,
			Callbacks: leaderelection.LeaderCallbacks{
				OnStartedLeading: func(ctx context.Context) {
					c.Log.Info("acquired gc lease", "identity", identity)
					c.loop(ctx)
				},
				OnStoppedLeading: func() {
					c.Log.Info("released gc lease", "identity", identity)
				},
			},
		})
	}
}
