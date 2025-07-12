package id

import (
	"fmt"
	"time"
)

const timestampLength = 10

func GenerateID(length int) (string, error) {
	randomLength := length - timestampLength
	if randomLength <= 1 {
		return "", fmt.Errorf("length must be greater than %d", timestampLength)
	}

	timestamp := time.Now().UnixMilli()
	encodedTimestamp := encodeBase36(timestamp, timestampLength)

	randomPart, err := generateBase62(randomLength)
	if err != nil {
		return "", err
	}

	return encodedTimestamp + randomPart, nil
}
