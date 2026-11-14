package kube

import (
	"context"
	"fmt"
	"time"

	batchv1 "k8s.io/api/batch/v1"
	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/tools/cache"
)

const (
	resyncPeriod  = 10 * time.Minute
	indexVersion  = "versionID"
	indexBuildJob = "jobName"
)

// Cache holds the informers for everything the hot paths read: Knative Services and pods in the
// functions namespace (functions cluster), Jobs and pods in the builds namespace (platform cluster).
type Cache struct {
	functionsNamespace string
	buildsNamespace    string

	services     cache.SharedIndexInformer
	functionPods cache.SharedIndexInformer
	buildJobs    cache.SharedIndexInformer
	buildPods    cache.SharedIndexInformer

	start []func(stop <-chan struct{})
}

func NewCache(functions, platform *Cluster, functionsNamespace, buildsNamespace string) *Cache {
	c := &Cache{functionsNamespace: functionsNamespace, buildsNamespace: buildsNamespace}

	dyn := dynamicinformer.NewFilteredDynamicSharedInformerFactory(functions.Dynamic, resyncPeriod, functionsNamespace, func(o *metav1.ListOptions) {
		o.LabelSelector = LabelVersionID
	})
	c.services = dyn.ForResource(KnativeServiceGVR).Informer()

	fnFactory := informers.NewSharedInformerFactoryWithOptions(functions.Kube, resyncPeriod,
		informers.WithNamespace(functionsNamespace),
		informers.WithTweakListOptions(func(o *metav1.ListOptions) { o.LabelSelector = LabelVersionID }),
	)
	c.functionPods = fnFactory.Core().V1().Pods().Informer()
	_ = c.functionPods.AddIndexers(cache.Indexers{indexVersion: func(obj any) ([]string, error) {
		pod, ok := obj.(*corev1.Pod)
		if !ok {
			return nil, nil
		}
		return []string{pod.Labels[LabelVersionID]}, nil
	}})

	buildFactory := informers.NewSharedInformerFactoryWithOptions(platform.Kube, resyncPeriod,
		informers.WithNamespace(buildsNamespace),
		informers.WithTweakListOptions(func(o *metav1.ListOptions) { o.LabelSelector = LabelBuildID }),
	)
	c.buildJobs = buildFactory.Batch().V1().Jobs().Informer()
	c.buildPods = buildFactory.Core().V1().Pods().Informer()
	_ = c.buildPods.AddIndexers(cache.Indexers{indexBuildJob: func(obj any) ([]string, error) {
		pod, ok := obj.(*corev1.Pod)
		if !ok {
			return nil, nil
		}
		if owner := metav1.GetControllerOf(pod); owner != nil && owner.Kind == "Job" {
			return []string{owner.Name}, nil
		}
		return nil, nil
	}})

	c.start = []func(<-chan struct{}){dyn.Start, fnFactory.Start, buildFactory.Start}
	return c
}

func (c *Cache) Start(ctx context.Context) error {
	for _, start := range c.start {
		start(ctx.Done())
	}

	syncCtx, cancel := context.WithTimeout(ctx, 2*time.Minute)
	defer cancel()
	if !cache.WaitForCacheSync(syncCtx.Done(), c.services.HasSynced, c.functionPods.HasSynced, c.buildJobs.HasSynced, c.buildPods.HasSynced) {
		return fmt.Errorf("informer caches did not sync")
	}
	return nil
}

func (c *Cache) KnativeService(name string) (*KnativeService, bool, error) {
	obj, exists, err := c.services.GetIndexer().GetByKey(c.functionsNamespace + "/" + name)
	if err != nil || !exists {
		return nil, false, err
	}
	svc, err := KnativeServiceFromUnstructured(obj)
	if err != nil {
		return nil, false, err
	}
	return svc, true, nil
}

func (c *Cache) KnativeServices(selector labels.Selector) ([]*KnativeService, error) {
	var out []*KnativeService
	err := cache.ListAll(c.services.GetIndexer(), selector, func(obj any) {
		if svc, err := KnativeServiceFromUnstructured(obj); err == nil {
			out = append(out, svc)
		}
	})
	return out, err
}

func (c *Cache) FunctionPod(name string) (*corev1.Pod, bool) {
	obj, exists, err := c.functionPods.GetIndexer().GetByKey(c.functionsNamespace + "/" + name)
	if err != nil || !exists {
		return nil, false
	}
	return obj.(*corev1.Pod), true
}

func (c *Cache) FunctionPodsForVersion(versionID string) []*corev1.Pod {
	objs, _ := c.functionPods.GetIndexer().ByIndex(indexVersion, versionID)
	pods := make([]*corev1.Pod, 0, len(objs))
	for _, obj := range objs {
		pods = append(pods, obj.(*corev1.Pod))
	}
	return pods
}

func (c *Cache) BuildJob(name string) (*batchv1.Job, bool) {
	obj, exists, err := c.buildJobs.GetIndexer().GetByKey(c.buildsNamespace + "/" + name)
	if err != nil || !exists {
		return nil, false
	}
	return obj.(*batchv1.Job), true
}

func (c *Cache) BuildPod(name string) (*corev1.Pod, bool) {
	obj, exists, err := c.buildPods.GetIndexer().GetByKey(c.buildsNamespace + "/" + name)
	if err != nil || !exists {
		return nil, false
	}
	return obj.(*corev1.Pod), true
}

func (c *Cache) BuildPodsForJob(jobName string) []*corev1.Pod {
	objs, _ := c.buildPods.GetIndexer().ByIndex(indexBuildJob, jobName)
	pods := make([]*corev1.Pod, 0, len(objs))
	for _, obj := range objs {
		pods = append(pods, obj.(*corev1.Pod))
	}
	return pods
}

func PodReady(pod *corev1.Pod) bool {
	if pod.DeletionTimestamp != nil || pod.Status.Phase != corev1.PodRunning {
		return false
	}
	for _, c := range pod.Status.Conditions {
		if c.Type == corev1.PodReady {
			return c.Status == corev1.ConditionTrue
		}
	}
	return false
}

func JobFinished(job *batchv1.Job) (finished bool, succeeded bool) {
	for _, c := range job.Status.Conditions {
		if c.Status != corev1.ConditionTrue {
			continue
		}
		switch c.Type {
		case batchv1.JobComplete, batchv1.JobSuccessCriteriaMet:
			return true, true
		case batchv1.JobFailed, batchv1.JobFailureTarget:
			return true, false
		}
	}
	return false, false
}
