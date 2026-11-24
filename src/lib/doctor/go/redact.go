package doctor

import (
	"encoding/json"
	"fmt"
	"math"
	"reflect"
	"regexp"
	"strings"
	"unicode/utf8"
)

const (
	maxRedactDepth  = 8
	maxStringLength = 2048
	redactedValue   = "***"
	truncatedValue  = "[truncated]"
	truncatedSuffix = "…[truncated]"
)

var (
	secretKeyParts = []string{
		"password", "passwd", "secret", "token", "apikey",
		"privatekey", "credential", "authorization", "cookie", "signature",
	}

	secretKeyNames = map[string]bool{"pwd": true, "pass": true, "auth": true}

	nonAlphanumeric = regexp.MustCompile(`[^a-z0-9]`)

	pemPattern         = regexp.MustCompile(`-----BEGIN ([A-Z0-9 ]+)-----[\s\S]*?-----END [A-Z0-9 ]+-----`)
	urlPasswordPattern = regexp.MustCompile(`([a-zA-Z][a-zA-Z0-9+.-]*://)([^\s:/?#@]*):([^\s/?#@]*)@`)
	queryPattern       = regexp.MustCompile(`(?i)([?&;](?:password|passwd|pwd|secret|token|access_token|refresh_token|id_token|api_key|apikey|key|sig|signature|credential|auth|x-amz-signature|x-amz-credential|x-amz-security-token)=)[^&\s#"']*`)
	bearerPattern      = regexp.MustCompile(`(?i)\b(bearer)\s+[A-Za-z0-9._~+/=-]{8,}`)
)

func IsSecretKey(key string) bool {
	normalized := nonAlphanumeric.ReplaceAllString(strings.ToLower(key), "")
	if secretKeyNames[normalized] {
		return true
	}

	for _, part := range secretKeyParts {
		if strings.Contains(normalized, part) {
			return true
		}
	}

	return false
}

func RedactString(value string) string {
	result := pemPattern.ReplaceAllString(value, "[redacted ${1}]")
	result = urlPasswordPattern.ReplaceAllString(result, "${1}${2}:"+redactedValue+"@")
	result = queryPattern.ReplaceAllString(result, "${1}"+redactedValue)
	result = bearerPattern.ReplaceAllString(result, "${1} "+redactedValue)

	if utf8.RuneCountInString(result) <= maxStringLength {
		return result
	}

	runes := []rune(result)
	return string(runes[:maxStringLength]) + truncatedSuffix
}

// Redact returns a JSON-compatible copy of value with secrets removed, following the rules in
// spec/README.md. Values that are not plain JSON types are converted through encoding/json.
func Redact(value any) any {
	return redactValue(value, 0)
}

func RedactDetails(details map[string]any) map[string]any {
	if details == nil {
		return nil
	}

	redacted, _ := redactValue(details, 0).(map[string]any)
	return redacted
}

func redactValue(value any, depth int) any {
	switch v := value.(type) {
	case nil:
		return nil
	case string:
		return RedactString(v)
	case bool:
		return v
	case float64:
		if math.IsNaN(v) || math.IsInf(v, 0) {
			return nil
		}
		return v
	case float32, int, int8, int16, int32, int64, uint, uint8, uint16, uint32, uint64, json.Number:
		return v
	case error:
		return RedactString(v.Error())
	case map[string]any:
		if depth >= maxRedactDepth {
			return truncatedValue
		}
		result := make(map[string]any, len(v))
		for key, item := range v {
			if IsSecretKey(key) && item != nil {
				result[key] = redactedValue
			} else {
				result[key] = redactValue(item, depth+1)
			}
		}
		return result
	case []any:
		if depth >= maxRedactDepth {
			return truncatedValue
		}
		result := make([]any, len(v))
		for index, item := range v {
			result[index] = redactValue(item, depth+1)
		}
		return result
	}

	return redactValue(toJSONValue(value), depth)
}

func toJSONValue(value any) any {
	reflected := reflect.ValueOf(value)
	if reflected.Kind() == reflect.Pointer && reflected.IsNil() {
		return nil
	}

	encoded, err := json.Marshal(value)
	if err != nil {
		return fmt.Sprint(value)
	}

	var decoded any
	if err := json.Unmarshal(encoded, &decoded); err != nil {
		return fmt.Sprint(value)
	}

	return decoded
}
