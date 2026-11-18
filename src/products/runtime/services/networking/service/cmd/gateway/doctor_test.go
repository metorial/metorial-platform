package main

import (
	"context"
	"testing"

	doctor "github.com/metorial/metorial-platform/src/lib/doctor/go"
)

func TestHostPort(t *testing.T) {
	cases := map[string]string{
		"http://network-logs:52250/rpc": "network-logs:52250",
		"https://logs.example.com":      "logs.example.com:443",
	}
	for input, want := range cases {
		got, err := hostPort(input)
		if err != nil || got != want {
			t.Errorf("hostPort(%q) = %q, %v; want %q", input, got, err, want)
		}
	}

	if _, err := hostPort("network-logs"); err == nil {
		t.Error("hostPort accepted an address without a scheme or port")
	}
}

func TestNetworkLogsWarnsWhenNotConfigured(t *testing.T) {
	d := doctor.New(doctor.Options{Component: "test"})
	if err := d.Register(networkLogsCheck(&config{})); err != nil {
		t.Fatal(err)
	}

	report, err := d.Run(context.Background(), true)
	if err != nil {
		t.Fatal(err)
	}
	if status := report.Checks[0].Status; status != doctor.StatusWarn {
		t.Fatalf("status %s, want warn", status)
	}
}
