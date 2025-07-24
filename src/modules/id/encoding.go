package id

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
)

// Base62: a-zA-Z0-9
const base62Charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"

// Base36: a-z0-9
const base36Charset = "abcdefghijklmnopqrstuvwxyz0123456789"

func encodeBase36(num int64, length int) string {
	var sb strings.Builder
	base := int64(len(base36Charset))

	for num > 0 {
		remainder := num % base
		sb.WriteByte(base36Charset[remainder])
		num = num / base
	}

	encoded := []rune(sb.String())
	for len(encoded) < length {
		encoded = append(encoded, '0')
	}

	for i, j := 0, len(encoded)-1; i < j; i, j = i+1, j-1 {
		encoded[i], encoded[j] = encoded[j], encoded[i]
	}

	return string(encoded[:length])
}

func generateBase62(length int) (string, error) {
	if length <= 0 {
		return "", fmt.Errorf("length must be positive")
	}
	base := big.NewInt(int64(len(base62Charset)))
	result := make([]byte, length)

	for i := 0; i < length; i++ {
		num, err := rand.Int(rand.Reader, base)
		if err != nil {
			return "", err
		}
		result[i] = base62Charset[num.Int64()]
	}
	return string(result), nil
}
