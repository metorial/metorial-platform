package kube

import (
	"fmt"
	"os"

	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

type Cluster struct {
	Config  *rest.Config
	Kube    kubernetes.Interface
	Dynamic dynamic.Interface
}

// LoadConfig uses the given kubeconfig path, then KUBECONFIG, then the in-cluster credentials.
func LoadConfig(kubeconfig string) (*rest.Config, error) {
	if kubeconfig == "" {
		kubeconfig = os.Getenv("KUBECONFIG")
	}
	if kubeconfig == "" && InCluster() {
		return rest.InClusterConfig()
	}

	rules := clientcmd.NewDefaultClientConfigLoadingRules()
	if kubeconfig != "" {
		rules.ExplicitPath = kubeconfig
	}
	overrides := &clientcmd.ConfigOverrides{}
	if context := os.Getenv("KUBE_CONTEXT"); context != "" {
		overrides.CurrentContext = context
	}
	return clientcmd.NewNonInteractiveDeferredLoadingClientConfig(rules, overrides).ClientConfig()
}

func InCluster() bool {
	return os.Getenv("KUBERNETES_SERVICE_HOST") != ""
}

func NewCluster(cfg *rest.Config) (*Cluster, error) {
	cfg = rest.CopyConfig(cfg)
	if cfg.QPS == 0 {
		cfg.QPS = 50
		cfg.Burst = 100
	}
	cfg.UserAgent = "runtime-cluster-manager"

	kube, err := kubernetes.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("kubernetes client: %w", err)
	}
	dyn, err := dynamic.NewForConfig(cfg)
	if err != nil {
		return nil, fmt.Errorf("dynamic client: %w", err)
	}
	return &Cluster{Config: cfg, Kube: kube, Dynamic: dyn}, nil
}
