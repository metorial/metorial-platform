package rendezvous

import (
	"crypto/sha1"
	"sort"
)

func score(key, element string) uint64 {
	h := sha1.New()
	h.Write([]byte(key))
	h.Write([]byte(element))
	sum := h.Sum(nil)
	// take first 8 bytes as uint64
	return uint64(sum[0])<<56 | uint64(sum[1])<<48 | uint64(sum[2])<<40 | uint64(sum[3])<<32 |
		uint64(sum[4])<<24 | uint64(sum[5])<<16 | uint64(sum[6])<<8 | uint64(sum[7])
}

func PickElementConsistently(key string, elements []string) string {
	if len(elements) == 0 {
		return ""
	}

	type scoredHost struct {
		host  string
		score uint64
	}
	shs := make([]scoredHost, 0, len(elements))
	for _, h := range elements {
		shs = append(shs, scoredHost{host: h, score: score(key, h)})
	}
	sort.Slice(shs, func(i, j int) bool {
		return shs[i].score > shs[j].score // descending
	})
	return shs[0].host
}
