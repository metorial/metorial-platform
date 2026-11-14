package functions

import (
	"context"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/client-go/dynamic"

	"github.com/metorial/metorial-platform/src/products/runtime/services/cluster-manager/service/internal/kube"
)

type serviceClient struct {
	r dynamic.ResourceInterface
}

func (c serviceClient) create(ctx context.Context, svc *kube.KnativeService) (*kube.KnativeService, error) {
	u, err := svc.ToUnstructured()
	if err != nil {
		return nil, err
	}
	created, err := c.r.Create(ctx, u, metav1.CreateOptions{FieldManager: kube.ManagedBy})
	if err != nil {
		return nil, err
	}
	return kube.KnativeServiceFromUnstructured(created)
}

func (c serviceClient) dryRun(ctx context.Context, svc *kube.KnativeService) error {
	u, err := svc.ToUnstructured()
	if err != nil {
		return err
	}
	_, err = c.r.Create(ctx, u, metav1.CreateOptions{DryRun: []string{metav1.DryRunAll}, FieldManager: kube.ManagedBy})
	return err
}

func (c serviceClient) get(ctx context.Context, name string) (*kube.KnativeService, error) {
	u, err := c.r.Get(ctx, name, metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	return kube.KnativeServiceFromUnstructured(u)
}

func (c serviceClient) delete(ctx context.Context, name string, opts metav1.DeleteOptions) error {
	return c.r.Delete(ctx, name, opts)
}

func (c serviceClient) patch(ctx context.Context, name string, patch []byte) error {
	_, err := c.r.Patch(ctx, name, types.MergePatchType, patch, metav1.PatchOptions{FieldManager: kube.ManagedBy})
	return err
}
