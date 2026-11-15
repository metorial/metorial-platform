package observer

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/servicediscovery"
)

type DiscoveringClient struct {
	client        *servicediscovery.Client
	namespaceName string
	serviceName   string
	httpClient    *http.Client
}

func NewDiscoveringClient(cfg aws.Config, namespaceName string, serviceName string) *DiscoveringClient {
	return &DiscoveringClient{
		client:        servicediscovery.NewFromConfig(cfg),
		namespaceName: namespaceName,
		serviceName:   serviceName,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *DiscoveringClient) Send(ctx context.Context, batch Batch) error {
	if c == nil || c.namespaceName == "" || c.serviceName == "" {
		return errors.New("observer discovery namespace and service are required")
	}

	res, err := c.client.DiscoverInstances(ctx, &servicediscovery.DiscoverInstancesInput{
		NamespaceName: aws.String(c.namespaceName),
		ServiceName:   aws.String(c.serviceName),
		MaxResults:    aws.Int32(1),
	})
	if err != nil {
		return err
	}
	if len(res.Instances) == 0 {
		return errors.New("observer discovery returned no instances")
	}

	attrs := res.Instances[0].Attributes
	ip := attrs["AWS_INSTANCE_IPV4"]
	if ip == "" {
		ip = attrs["AWS_INSTANCE_IPV6"]
	}
	port := attrs["AWS_INSTANCE_PORT"]
	if port == "" {
		port = "52210"
	}
	if ip == "" {
		return errors.New("observer discovery instance is missing IP address")
	}

	client := &Client{
		URL:        "http://" + ip + ":" + port + "/ingest",
		HTTPClient: c.httpClient,
	}
	return client.Send(ctx, batch)
}
