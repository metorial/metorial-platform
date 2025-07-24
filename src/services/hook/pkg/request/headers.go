package request

func GetRequestHeaders(signature string) map[string]string {
	headers := make(map[string]string)
	if signature != "" {
		headers["Metorial-Signature"] = signature
	}

	headers["Content-Type"] = "application/json"
	headers["User-Agent"] = "Metorial Webhook (https://metorial.com)"
	headers["Accept"] = "*/*"
	headers["Cache-Control"] = "no-cache"

	return headers
}
