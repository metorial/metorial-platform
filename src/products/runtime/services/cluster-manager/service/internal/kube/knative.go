package kube

import (
	"fmt"

	corev1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

// Minimal typed view of serving.knative.dev/v1 Services. Only the fields the cluster-manager
// renders or reads are modelled, so knative.dev/serving isn't a dependency.

var KnativeServiceGVR = schema.GroupVersionResource{Group: "serving.knative.dev", Version: "v1", Resource: "services"}

const (
	KnativeAPIVersion = "serving.knative.dev/v1"
	KnativeKind       = "Service"

	AnnotationMinScale          = "autoscaling.knative.dev/min-scale"
	AnnotationMaxScale          = "autoscaling.knative.dev/max-scale"
	AnnotationInitialScale      = "autoscaling.knative.dev/initial-scale"
	AnnotationScaleDownDelay    = "autoscaling.knative.dev/scale-down-delay"
	AnnotationTargetUtilization = "autoscaling.knative.dev/target-utilization-percentage"
	AnnotationWindow            = "autoscaling.knative.dev/window"
	LabelVisibility             = "networking.knative.dev/visibility"
	VisibilityClusterLocal      = "cluster-local"
)

type KnativeService struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec   KnativeServiceSpec   `json:"spec"`
	Status KnativeServiceStatus `json:"status,omitempty"`
}

type KnativeServiceSpec struct {
	Template RevisionTemplate `json:"template"`
}

type RevisionTemplate struct {
	metav1.ObjectMeta `json:"metadata,omitempty"`

	Spec RevisionSpec `json:"spec"`
}

type RevisionSpec struct {
	corev1.PodSpec `json:",inline"`

	ContainerConcurrency *int64 `json:"containerConcurrency,omitempty"`
	TimeoutSeconds       *int64 `json:"timeoutSeconds,omitempty"`
}

type KnativeServiceStatus struct {
	ObservedGeneration      int64              `json:"observedGeneration,omitempty"`
	Conditions              []KnativeCondition `json:"conditions,omitempty"`
	URL                     string             `json:"url,omitempty"`
	Address                 *KnativeAddress    `json:"address,omitempty"`
	LatestReadyRevisionName string             `json:"latestReadyRevisionName,omitempty"`
}

type KnativeAddress struct {
	URL string `json:"url,omitempty"`
}

type KnativeCondition struct {
	Type               string      `json:"type"`
	Status             string      `json:"status"`
	Reason             string      `json:"reason,omitempty"`
	Message            string      `json:"message,omitempty"`
	LastTransitionTime metav1.Time `json:"lastTransitionTime,omitempty"`
}

type Readiness int

const (
	ReadinessUnknown Readiness = iota
	ReadinessReady
	ReadinessFailed
)

// Readiness reports the Ready condition for the current generation. Failed is only reported
// once Knative has observed the current spec, so a stale failure isn't mistaken for a new one.
func (s *KnativeService) Readiness() (Readiness, string) {
	if s.Status.ObservedGeneration < s.Generation {
		return ReadinessUnknown, ""
	}
	for _, c := range s.Status.Conditions {
		if c.Type != "Ready" {
			continue
		}
		switch c.Status {
		case "True":
			return ReadinessReady, ""
		case "False":
			return ReadinessFailed, joinReason(c.Reason, c.Message)
		default:
			return ReadinessUnknown, joinReason(c.Reason, c.Message)
		}
	}
	return ReadinessUnknown, ""
}

func joinReason(reason, message string) string {
	switch {
	case reason == "":
		return message
	case message == "":
		return reason
	default:
		return reason + ": " + message
	}
}

func (s *KnativeService) ToUnstructured() (*unstructured.Unstructured, error) {
	s.APIVersion = KnativeAPIVersion
	s.Kind = KnativeKind

	obj, err := runtime.DefaultUnstructuredConverter.ToUnstructured(s)
	if err != nil {
		return nil, err
	}
	u := &unstructured.Unstructured{Object: obj}
	unstructured.RemoveNestedField(u.Object, "status")
	unstructured.RemoveNestedField(u.Object, "metadata", "creationTimestamp")
	unstructured.RemoveNestedField(u.Object, "spec", "template", "metadata", "creationTimestamp")
	return u, nil
}

func KnativeServiceFromUnstructured(obj any) (*KnativeService, error) {
	u, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return nil, fmt.Errorf("unexpected object %T", obj)
	}
	svc := &KnativeService{}
	if err := runtime.DefaultUnstructuredConverter.FromUnstructured(u.Object, svc); err != nil {
		return nil, err
	}
	return svc, nil
}
