package commitbatch

type segment int

const (
	segmentContent segment = iota
	segmentReferences
	segmentFinal
)

// queue hands out batches in plan order. A batch never spans segments, except that the
// whole Final segment rides along in the last batch of the segment before it when it
// fits; references only ride along with reference batches, because a writer may need a
// different request type for them.
type queue struct {
	segments [3][]Change
	cursor   int
	total    int

	prefixBytes    []int64
	prefixOversize []int
}

func newQueue(plan *Plan) *queue {
	q := &queue{segments: [3][]Change{plan.Content, plan.References, plan.Final}}
	q.total = plan.Len()
	return q
}

func (q *queue) done() bool { return q.cursor >= q.total }

func (q *queue) locate(i int) (segment, int) {
	for s := segmentContent; s < segmentFinal; s++ {
		if i < len(q.segments[s]) {
			return s, i
		}
		i -= len(q.segments[s])
	}
	return segmentFinal, i
}

func (q *queue) at(i int) Change {
	s, offset := q.locate(i)
	return q.segments[s][offset]
}

func (q *queue) advance(n int) { q.cursor = min(q.cursor+n, q.total) }

func oversized(c Change, limits BatchLimits) bool {
	return c.Kind == ChangeAdd && limits.MaxInlineFileBytes > 0 && c.Size > limits.MaxInlineFileBytes
}

// unit returns the changes from i that must share a batch (a WithNext chain).
func (q *queue) unit(i int) []Change {
	unit := []Change{q.at(i)}
	for unit[len(unit)-1].WithNext && i+len(unit) < q.total {
		unit = append(unit, q.at(i+len(unit)))
	}
	return unit
}

func (q *queue) next(size int64, limits BatchLimits) []Change {
	first, _ := q.locate(q.cursor)

	var (
		batch []Change
		bytes int64
	)
	for i := q.cursor; i < q.total; {
		s, _ := q.locate(i)
		if s != first && !limits.SpanSegments {
			if s == segmentFinal && i == q.total-len(q.segments[segmentFinal]) {
				batch = q.absorbFinal(batch, bytes, first, size, limits)
			}
			break
		}

		unit := q.unit(i)
		if unitOversized(unit, limits) {
			if len(batch) == 0 {
				batch = append(batch, unit...)
			}
			break
		}

		encoded := encodedBytes(unit)
		if len(batch) > 0 && (bytes+encoded > size || len(batch)+len(unit) > limits.MaxChanges) {
			break
		}
		batch = append(batch, unit...)
		bytes += encoded
		i += len(unit)
	}

	return batch
}

func unitOversized(unit []Change, limits BatchLimits) bool {
	for _, c := range unit {
		if oversized(c, limits) {
			return true
		}
	}
	return false
}

// SingleUnit reports whether a batch is one change plus the changes tied to it, the
// smallest batch the runner can make.
func SingleUnit(changes []Change) bool {
	if len(changes) == 0 {
		return false
	}
	for _, c := range changes[:len(changes)-1] {
		if !c.WithNext {
			return false
		}
	}
	return true
}

func (q *queue) absorbFinal(batch []Change, bytes int64, from segment, size int64, limits BatchLimits) []Change {
	final := q.segments[segmentFinal]
	if len(batch)+len(final) > limits.MaxChanges {
		return batch
	}

	for _, c := range final {
		if oversized(c, limits) || (c.Kind == ChangeReference && from != segmentReferences) {
			return batch
		}
		bytes += EncodedBytes(c)
	}
	if bytes > size {
		return batch
	}

	return append(batch, final...)
}

// estimateBatches roughly counts the batches left including the current one, for
// commit messages like "(2/7)".
func (q *queue) estimateBatches(size int64, limits BatchLimits, current int) int {
	if q.prefixBytes == nil {
		q.buildPrefix(limits)
	}

	estimate := 1
	start := min(q.cursor+current, q.total)
	segmentStart := 0

	for s := segmentContent; s <= segmentFinal; s++ {
		segmentEnd := segmentStart + len(q.segments[s])
		if limits.SpanSegments {
			if s != segmentFinal {
				continue
			}
			segmentStart, segmentEnd = 0, q.total
		}

		from := max(start, segmentStart)
		if from < segmentEnd {
			bytes := q.prefixBytes[segmentEnd] - q.prefixBytes[from]
			oversize := q.prefixOversize[segmentEnd] - q.prefixOversize[from]
			count := segmentEnd - from - oversize

			estimate += oversize
			if count > 0 {
				estimate += max(int((bytes+size-1)/size), (count+limits.MaxChanges-1)/limits.MaxChanges)
			}
		}
		segmentStart = segmentEnd
	}

	return estimate
}

func (q *queue) buildPrefix(limits BatchLimits) {
	q.prefixBytes = make([]int64, q.total+1)
	q.prefixOversize = make([]int, q.total+1)

	i := 0
	for _, changes := range q.segments {
		for _, c := range changes {
			q.prefixBytes[i+1], q.prefixOversize[i+1] = q.prefixBytes[i], q.prefixOversize[i]
			if oversized(c, limits) {
				q.prefixOversize[i+1]++
			} else {
				q.prefixBytes[i+1] += EncodedBytes(c)
			}
			i++
		}
	}
}
