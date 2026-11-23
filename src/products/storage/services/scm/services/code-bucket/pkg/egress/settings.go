package egress

import "fmt"

const (
	AllowPrivateNetworksEnv = "ORIGIN_SCM_ALLOW_PRIVATE_NETWORKS"
	editionEnv              = "METORIAL_EDITION"
	onPremEdition           = "on-prem"
)

// ResolveAllowPrivateNetworks reads ORIGIN_SCM_ALLOW_PRIVATE_NETWORKS the way Origin
// does: "true" or "false" when set, otherwise allowed in the on-prem edition only.
func ResolveAllowPrivateNetworks(getenv func(string) string) (bool, error) {
	switch value := getenv(AllowPrivateNetworksEnv); value {
	case "true":
		return true, nil
	case "false":
		return false, nil
	case "":
		return getenv(editionEnv) == onPremEdition, nil
	default:
		return false, fmt.Errorf("%s must be \"true\" or \"false\", got %q", AllowPrivateNetworksEnv, value)
	}
}
