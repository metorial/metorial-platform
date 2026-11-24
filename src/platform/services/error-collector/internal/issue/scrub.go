package issue

import (
	"net"
	"regexp"
	"strings"
	"unicode/utf8"

	doctor "github.com/metorial/metorial-platform/src/lib/doctor/go"
)

const maxTextLength = 1024

var (
	emailPattern = regexp.MustCompile(`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`)
	jwtPattern   = regexp.MustCompile(`\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b`)
	tokenPattern = regexp.MustCompile(`\b[A-Za-z0-9_-]{40,}\b`)
	ipv4Pattern  = regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
	ipv6Pattern  = regexp.MustCompile(`\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\b`)
)

// Scrub removes what a customer would not want to leave the installation: credentials (through
// the doctor redactor), tokens, email addresses and public IP addresses. Private and loopback
// addresses stay, since they point at the customer's own infrastructure and help support.
func Scrub(value string) string {
	value = doctor.RedactString(value)
	value = jwtPattern.ReplaceAllString(value, "<token>")
	value = emailPattern.ReplaceAllString(value, "<email>")
	value = tokenPattern.ReplaceAllStringFunc(value, func(match string) string {
		if strings.Trim(match, "0123456789abcdefABCDEF-") == "" && len(match) <= 64 {
			return match
		}
		return "<token>"
	})
	value = ipv4Pattern.ReplaceAllStringFunc(value, redactPublicIP)
	value = ipv6Pattern.ReplaceAllStringFunc(value, redactPublicIP)

	return truncate(value, maxTextLength)
}

func redactPublicIP(match string) string {
	ip := net.ParseIP(match)
	if ip == nil || ip.IsPrivate() || ip.IsLoopback() || ip.IsUnspecified() || ip.IsLinkLocalUnicast() {
		return match
	}
	return "<ip>"
}

func truncate(value string, limit int) string {
	if utf8.RuneCountInString(value) <= limit {
		return value
	}

	runes := []rune(value)
	return string(runes[:limit]) + "…"
}
