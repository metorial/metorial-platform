package bitbucket

import (
	"context"
	"strings"
	"testing"

	"github.com/metorial/metorial/services/code-bucket/pkg/egress"
)

func init() {
	egress.AllowPrivateNetworks(true)
}

func refusePrivateNetworks(t *testing.T) {
	t.Helper()

	egress.AllowPrivateNetworks(false)
	t.Cleanup(func() { egress.AllowPrivateNetworks(true) })
}

func TestCloneRefusesNonPublicAddresses(t *testing.T) {
	refusePrivateNetworks(t)

	for _, cloneURL := range []string{
		"https://127.0.0.1:9/scm/team/repo.git",
		"https://169.254.169.254/scm/team/repo.git",
		"https://[::1]:9/scm/team/repo.git",
	} {
		_, _, cleanup, err := cloneDataCenterRepo(context.Background(), cloneURL, "main", "", "token", true)
		if err == nil {
			cleanup()
			t.Fatalf("expected cloning %s to fail", cloneURL)
		}
		if !strings.Contains(err.Error(), egress.ErrAddressNotAllowed.Error()) {
			t.Fatalf("cloning %s failed with %v, want the address to be refused", cloneURL, err)
		}
	}
}
