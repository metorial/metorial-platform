package logstore

import (
	"context"
	"testing"
	"time"

	"github.com/metorial/metorial-platform/src/lowerdeck/go/ldrpc"
	"github.com/metorial/metorial-platform/src/products/runtime/packages/egress"
	"github.com/metorial/metorial-platform/src/products/runtime/services/networking/service/internal/gateway"
)

func TestGatewayRecorderShipsToLogStore(t *testing.T) {
	store := openTestStore(t, testConfig(t))
	baseURL := newRPCServer(t, store, Auth{HMACSecret: "secret"})
	sender := &gateway.RPCSender{Client: rpcClient(t, baseURL, ldrpc.ClientOptions{HMACToken: "secret"})}

	recorder := gateway.NewRecorder("gw-e2e", time.Hour, nil)
	function := &egress.Grant{TenantID: "ten_1", FunctionID: "fn_1", EnclaveID: "enc_1", Source: egress.SourceKnative}
	build := &egress.Grant{BuildRunID: "brun_1", Source: egress.SourceBuild}
	for range 3 {
		recorder.Record(function, "example.com", "93.184.216.34", 443, gateway.DecisionAllowed)
	}
	recorder.Record(function, "evil.example", "10.0.0.1", 0, gateway.DecisionDenied)
	recorder.Record(build, "registry.npmjs.org", "104.16.0.1", 443, gateway.DecisionAllowed)

	if sent, err := recorder.Flush(context.Background(), sender); err != nil || sent != 1 {
		t.Fatalf("sent=%d err=%v", sent, err)
	}

	records, err := store.List(context.Background(), Query{})
	if err != nil || len(records) != 3 {
		t.Fatalf("records %+v err %v", records, err)
	}
	byHost := map[string]Record{}
	for _, record := range records {
		byHost[record.Hostname] = record
	}
	if r := byHost["example.com"]; r.Count != 3 || r.Decision != DecisionAllowed || r.Source != SourceKnative || r.EnclaveID != "enc_1" {
		t.Fatalf("allowed %+v", r)
	}
	if r := byHost["evil.example"]; r.Decision != DecisionDenied || r.Port != 0 {
		t.Fatalf("denied %+v", r)
	}
	if r := byHost["registry.npmjs.org"]; r.BuildRunID != "brun_1" || r.Source != SourceBuild || r.TenantID != "" {
		t.Fatalf("build %+v", r)
	}
}
