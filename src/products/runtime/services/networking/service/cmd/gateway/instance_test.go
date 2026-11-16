package main

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/internal/gateway"
)

type capturingSender struct{ ids []string }

func (s *capturingSender) Send(_ context.Context, batch gateway.Batch) error {
	s.ids = append(s.ids, batch.ID)
	return nil
}

func TestRestartedGatewayInSamePodSendsNewBatchIDs(t *testing.T) {
	sender := &capturingSender{}
	grant := &egress.Grant{TenantID: "ten_1", FunctionID: "fn_1", Source: egress.SourceKnative}

	for range 2 {
		id := newInstanceID("egress-gateway-7d9f-abcde")
		if !strings.HasPrefix(id, "egress-gateway-7d9f-abcde-") {
			t.Fatalf("instance id %q lost the configured prefix", id)
		}

		recorder := gateway.NewRecorder(id, time.Hour, nil)
		recorder.Record(grant, "api.example.com", "93.184.216.34", 443, gateway.DecisionAllowed)
		if _, err := recorder.Flush(context.Background(), sender); err != nil {
			t.Fatal(err)
		}
	}

	if len(sender.ids) != 2 || sender.ids[0] == sender.ids[1] {
		t.Fatalf("batch ids %v must differ across restarts", sender.ids)
	}
}

func TestInstanceIDFallsBackToHostname(t *testing.T) {
	if id := newInstanceID(""); id == "" {
		t.Fatal("empty instance id")
	}
}
