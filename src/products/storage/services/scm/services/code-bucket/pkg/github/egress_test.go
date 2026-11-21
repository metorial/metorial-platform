package github

import "github.com/metorial/metorial/services/code-bucket/pkg/egress"

func init() {
	egress.AllowPrivateNetworks(true)
}
