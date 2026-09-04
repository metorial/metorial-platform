package service

import (
	"errors"
	"testing"
)

// The response holds every file at once, so the budget has to span batches. A
// per-batch reset would let an arbitrarily large bucket through.
func TestInlineContentBudgetAccumulatesAcrossBatches(t *testing.T) {
	budget := inlineContentBudget{limit: 30}

	for _, size := range []int64{10, 10} {
		if err := budget.take(size); err != nil {
			t.Fatalf("take(%d) refused within the limit: %v", size, err)
		}
	}

	if err := budget.take(10); err != nil {
		t.Fatalf("take at exactly the limit was refused: %v", err)
	}
	if err := budget.take(1); !errors.Is(err, errBucketTooLargeForInlineContent) {
		t.Fatalf("take past the limit returned %v", err)
	}
}

func TestInlineContentBudgetAdmitsAnEmptyBucket(t *testing.T) {
	budget := inlineContentBudget{limit: maxInlineBucketContentBytes}

	if err := budget.take(0); err != nil {
		t.Fatalf("an empty bucket was refused: %v", err)
	}
}

// A single file over the ceiling has to be refused too, not just a large total.
func TestInlineContentBudgetRefusesOneOversizedFile(t *testing.T) {
	budget := inlineContentBudget{limit: maxInlineBucketContentBytes}

	err := budget.take(maxInlineBucketContentBytes + 1)
	if !errors.Is(err, errBucketTooLargeForInlineContent) {
		t.Fatalf("expected an oversized file to be refused, got %v", err)
	}
}
