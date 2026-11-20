package builds

import (
	"testing"

	corev1 "k8s.io/api/core/v1"
)

func TestPodPendingReason(t *testing.T) {
	cases := []struct {
		name string
		pod  corev1.PodStatus
		want string
	}{
		{
			name: "unschedulable",
			pod: corev1.PodStatus{
				Phase: corev1.PodPending,
				Conditions: []corev1.PodCondition{{
					Type:    corev1.PodScheduled,
					Status:  corev1.ConditionFalse,
					Reason:  "Unschedulable",
					Message: "0/1 nodes are available: 1 Insufficient memory.",
				}},
			},
			want: "Unschedulable: 0/1 nodes are available: 1 Insufficient memory.",
		},
		{
			name: "image pull failure",
			pod: corev1.PodStatus{
				Phase:      corev1.PodPending,
				Conditions: []corev1.PodCondition{{Type: corev1.PodScheduled, Status: corev1.ConditionTrue}},
				ContainerStatuses: []corev1.ContainerStatus{{
					Name: containerName,
					State: corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{
						Reason:  "ImagePullBackOff",
						Message: "Back-off pulling image",
					}},
				}},
			},
			want: "ImagePullBackOff: Back-off pulling image",
		},
		{
			name: "container still being created",
			pod: corev1.PodStatus{
				Phase:      corev1.PodPending,
				Conditions: []corev1.PodCondition{{Type: corev1.PodScheduled, Status: corev1.ConditionTrue}},
				ContainerStatuses: []corev1.ContainerStatus{{
					Name:  containerName,
					State: corev1.ContainerState{Waiting: &corev1.ContainerStateWaiting{Reason: "ContainerCreating"}},
				}},
			},
		},
		{
			name: "no conditions yet",
			pod:  corev1.PodStatus{Phase: corev1.PodPending},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := podPendingReason(&corev1.Pod{Status: tc.pod})
			if tc.want == "" {
				if got != nil {
					t.Fatalf("expected no reason, got %q", *got)
				}
				return
			}
			if got == nil || *got != tc.want {
				t.Fatalf("expected %q, got %v", tc.want, got)
			}
		})
	}
}
