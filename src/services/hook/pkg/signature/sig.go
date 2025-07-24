package signature

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"
)

func GenerateSignature(body []byte, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write(body)
	signature := hex.EncodeToString(h.Sum(nil))

	return signature
}

func GenerateWebhookSignature(body []byte, secret string) string {
	timestamp := time.Now().Unix()

	// Create the signed payload (timestamp + body)
	payload := fmt.Sprintf("%d.%s", timestamp, string(body))

	// Generate HMAC-SHA256 signature
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(payload))
	signature := hex.EncodeToString(h.Sum(nil))

	return fmt.Sprintf("s=metorial,t=%d,v1=%s", timestamp, signature)
}

func VerifySignature(body []byte, secret, expectedSignature string) bool {
	actualSignature := GenerateSignature(body, secret)
	return hmac.Equal([]byte(expectedSignature), []byte(actualSignature))
}
