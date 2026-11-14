package kubeauth

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/metorial/metorial-platform/src/lib/rpc/go"
)

type ServiceAccount struct {
	Namespace string
	Name      string
}

// ParseServiceAccount reads "namespace/name" or "system:serviceaccount:namespace:name".
func ParseServiceAccount(s string) (ServiceAccount, error) {
	if rest, ok := strings.CutPrefix(s, serviceAccountUser); ok {
		s = strings.Replace(rest, ":", "/", 1)
	}
	namespace, name, ok := strings.Cut(s, "/")
	if !ok || namespace == "" || name == "" || strings.ContainsAny(name, "/:") {
		return ServiceAccount{}, fmt.Errorf("kubeauth: invalid ServiceAccount %q, expected namespace/name", s)
	}
	return ServiceAccount{Namespace: namespace, Name: name}, nil
}

func (sa ServiceAccount) String() string {
	return sa.Namespace + "/" + sa.Name
}

type Allowlist []ServiceAccount

func ParseAllowlist(entries ...string) (Allowlist, error) {
	list := make(Allowlist, 0, len(entries))
	for _, entry := range entries {
		sa, err := ParseServiceAccount(strings.TrimSpace(entry))
		if err != nil {
			return nil, err
		}
		list = append(list, sa)
	}
	return list, nil
}

func (a Allowlist) Allows(id *Identity) bool {
	if id == nil {
		return false
	}
	for _, sa := range a {
		if sa.Namespace == id.Namespace && sa.Name == id.ServiceAccount {
			return true
		}
	}
	return false
}

// MethodAllowlist is an ldrpc middleware restricting methods by caller. Keys are method names
// ("build:start") or namespace prefixes ending in ":" ("build:"); the longest match wins.
// Methods without a rule are forbidden to everyone.
func MethodAllowlist(rules map[string]Allowlist) ldrpc.Middleware {
	return func(next ldrpc.HandlerFunc) ldrpc.HandlerFunc {
		return func(ctx context.Context, payload json.RawMessage) (any, error) {
			info := ldrpc.CallInfoFromContext(ctx)
			identity, _ := IdentityFromContext(ctx)
			if info == nil || !methodRule(rules, info.Method).Allows(identity) {
				return nil, ldrpc.ForbiddenError()
			}
			return next(ctx, payload)
		}
	}
}

func methodRule(rules map[string]Allowlist, method string) Allowlist {
	if rule, ok := rules[method]; ok {
		return rule
	}

	var best string
	var rule Allowlist
	for key, list := range rules {
		if strings.HasSuffix(key, ":") && strings.HasPrefix(method, key) && len(key) > len(best) {
			best, rule = key, list
		}
	}
	return rule
}
