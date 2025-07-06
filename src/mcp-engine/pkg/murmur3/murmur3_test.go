package murmur3

import (
	"encoding/hex"
	"testing"
)

func TestMurmur3_32_DifferentSeeds(t *testing.T) {
	data := []byte("seed test")
	hash1 := Murmur3_32(data, 0)
	hash2 := Murmur3_32(data, 1)
	if hash1 == hash2 {
		t.Errorf("Expected different hashes for different seeds, got %x and %x", hash1, hash2)
	}
}

func TestMurmur3_32_Deterministic(t *testing.T) {
	data := []byte("deterministic test")
	seed := uint32(12345)
	hash1 := Murmur3_32(data, seed)
	hash2 := Murmur3_32(data, seed)
	if hash1 != hash2 {
		t.Errorf("Expected deterministic output, got %x and %x", hash1, hash2)
	}
}

func TestMurmur3_32_AllTailLengths(t *testing.T) {
	seed := uint32(0)
	for l := 0; l < 4; l++ {
		data := make([]byte, l)
		for i := 0; i < l; i++ {
			data[i] = byte(i + 1)
		}
		_ = Murmur3_32(data, seed) // Just ensure no panic
	}
}
func BenchmarkMurmur3_32(b *testing.B) {
	data, _ := hex.DecodeString("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
	for i := 0; i < b.N; i++ {
		Murmur3_32(data, 0)
	}
}
