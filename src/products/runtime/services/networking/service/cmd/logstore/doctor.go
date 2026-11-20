package main

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	doctor "github.com/metorial/metorial-platform/src/lib/doctor/go"
	"github.com/metorial/metorial-platform/src/lib/rpc/go"
	"github.com/metorial/metorial-platform/src/lib/rpc/go/kubeauth"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/internal/logstore"
)

const doctorDocs = "datacenter/operations/doctor#network-logs"

func doctorResolution(summary string) *doctor.Resolution {
	link := doctorDocs
	return &doctor.Resolution{Summary: summary, Docs: &link}
}

func newDoctor(cfg *config, store *logstore.Store, auth logstore.Auth) (*doctor.Doctor, error) {
	d := doctor.New(doctor.Options{Component: "network-logs"})
	err := d.Register(
		doctor.Check{
			ID:       "postgres.connect",
			Title:    "Postgres accepts connections",
			Category: doctor.CategoryDatabase,
			Severity: doctor.SeverityCritical,
			Target:   "postgres",
			Run:      doctor.Probe("Postgres", store.Ping, 250*time.Millisecond),
		},
		doctor.Check{
			ID:        "postgres.schema",
			Title:     "The network log tables exist",
			Category:  doctor.CategoryDatabase,
			Severity:  doctor.SeverityCritical,
			Target:    "postgres",
			DependsOn: []string{"postgres.connect"},
			Run: func(ctx context.Context, r *doctor.Result) error {
				missing, err := store.MissingTables(ctx)
				if err != nil {
					return err
				}
				if len(missing) > 0 {
					r.Fail(fmt.Sprintf("Tables are missing: %v.", missing), doctorResolution(
						"Restart network-logs so it migrates the schema; the database user needs CREATE on the database.",
					), map[string]any{"missing": missing})
					return nil
				}

				r.Pass("The schema is migrated.", nil)
				return nil
			},
		},
		tokenReviewCheck(cfg, auth.Kube),
		doctor.Check{
			ID:        "retention",
			Title:     "Old observations are cleaned up",
			Category:  doctor.CategoryDatabase,
			Severity:  doctor.SeverityWarning,
			Target:    "postgres",
			DependsOn: []string{"postgres.schema"},
			Run: func(ctx context.Context, r *doctor.Result) error {
				oldest, err := store.OldestObservation(ctx)
				if err != nil {
					return err
				}
				if oldest.IsZero() {
					r.Pass("No observations are stored yet.", nil)
					return nil
				}

				// Cleanup runs every cleanupInterval, so rows may outlive the retention by that much.
				limit := cfg.retention + 2*cfg.cleanupInterval
				age := time.Since(oldest)
				details := map[string]any{"oldest": oldest.UTC().Format(time.RFC3339), "retentionHours": cfg.retention.Hours()}
				if age > limit {
					r.Warn(fmt.Sprintf("The oldest observation is %s old, beyond the %s retention.", age.Round(time.Hour), cfg.retention), doctorResolution(
						"Check the network-logs logs for failing cleanup runs.",
					), details)
					return nil
				}

				r.Pass("Observations are within the retention.", details)
				return nil
			},
		},
	)
	if err != nil {
		return nil, err
	}

	return d, nil
}

func tokenReviewCheck(cfg *config, verifier *kubeauth.Verifier) doctor.Check {
	return doctor.Check{
		ID:       "kube.tokenreview",
		Title:    "Kubernetes tokens can be validated",
		Category: doctor.CategorySecurity,
		Severity: doctor.SeverityCritical,
		Target:   "kubernetes",
		Timeout:  12 * time.Second,
		Run: func(ctx context.Context, r *doctor.Result) error {
			if cfg.authMode != authModeKube || verifier == nil {
				r.Skip("NETWORK_LOGS_AUTH is not kubeauth.", nil)
				return nil
			}

			_, err := verifier.Verify(ctx, "metorial-doctor-probe")
			var rpcErr *ldrpc.Error
			if errors.As(err, &rpcErr) && rpcErr.Status == http.StatusUnauthorized {
				r.Pass("TokenReview answered and rejected a probe token.", nil)
				return nil
			}
			if err == nil {
				r.Fail("TokenReview accepted a probe token.", doctorResolution("Check the API server's authentication configuration."), nil)
				return nil
			}

			r.Fail("TokenReview is unavailable: "+doctor.DescribeError(err).Message, doctorResolution(
				"Bind system:auth-delegator to the network-logs service account so it may create TokenReviews.",
			), nil)
			return nil
		},
	}
}

func withDoctor(d *doctor.Doctor, next http.Handler) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /doctor", d.Handler())
	mux.Handle("/", next)
	return mux
}
