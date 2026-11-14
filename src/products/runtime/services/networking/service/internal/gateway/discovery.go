package gateway

import (
	"context"
	"errors"
	"math/rand/v2"
	"net"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/servicediscovery"
	"github.com/aws/aws-sdk-go-v2/service/servicediscovery/types"
)

type InstanceDiscoverer interface {
	DiscoverInstances(ctx context.Context, in *servicediscovery.DiscoverInstancesInput, opts ...func(*servicediscovery.Options)) (*servicediscovery.DiscoverInstancesOutput, error)
}

// DiscoveryTransport sends each request to an instance found through AWS Cloud Map's
// DiscoverInstances API. The gateway's VPC can't resolve the namespace's private DNS,
// which is how the deflector reached the observer too.
type DiscoveryTransport struct {
	Base      http.RoundTripper
	Discovery InstanceDiscoverer
	Namespace string
	Service   string
	Port      int
	TTL       time.Duration

	mu        sync.Mutex
	hosts     []string
	fetchedAt time.Time
}

func (t *DiscoveryTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	host, err := t.pick(req.Context())
	if err != nil {
		if req.Body != nil {
			_ = req.Body.Close()
		}
		return nil, err
	}

	out := req.Clone(req.Context())
	out.URL.Host = host
	out.Host = host

	base := t.Base
	if base == nil {
		base = http.DefaultTransport
	}
	response, err := base.RoundTrip(out)
	if err != nil {
		t.invalidate()
	}
	return response, err
}

func (t *DiscoveryTransport) pick(ctx context.Context) (string, error) {
	t.mu.Lock()
	defer t.mu.Unlock()

	ttl := t.TTL
	if ttl <= 0 {
		ttl = 30 * time.Second
	}
	if len(t.hosts) == 0 || time.Since(t.fetchedAt) > ttl {
		hosts, err := t.discover(ctx)
		if err != nil {
			if len(t.hosts) == 0 {
				return "", err
			}
		} else {
			t.hosts = hosts
			t.fetchedAt = time.Now()
		}
	}
	return t.hosts[rand.IntN(len(t.hosts))], nil
}

func (t *DiscoveryTransport) discover(ctx context.Context) ([]string, error) {
	response, err := t.Discovery.DiscoverInstances(ctx, &servicediscovery.DiscoverInstancesInput{
		NamespaceName: aws.String(t.Namespace),
		ServiceName:   aws.String(t.Service),
		HealthStatus:  types.HealthStatusFilterHealthyOrElseAll,
		MaxResults:    aws.Int32(10),
	})
	if err != nil {
		return nil, err
	}

	hosts := make([]string, 0, len(response.Instances))
	for _, instance := range response.Instances {
		ip := instance.Attributes["AWS_INSTANCE_IPV4"]
		if ip == "" {
			ip = instance.Attributes["AWS_INSTANCE_IPV6"]
		}
		if ip != "" {
			hosts = append(hosts, net.JoinHostPort(ip, strconv.Itoa(t.Port)))
		}
	}
	if len(hosts) == 0 {
		return nil, errors.New("cloud map discovery returned no instances with an address")
	}
	return hosts, nil
}

func (t *DiscoveryTransport) invalidate() {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.fetchedAt = time.Time{}
}
