package ldrpc

import (
	"bytes"
	"encoding/json"
	"math"
	"os"
	"reflect"
	"testing"
	"time"
)

type vectors struct {
	Serialize []struct {
		Name    string `json:"name"`
		Encoded string `json:"encoded"`
		Plain   string `json:"plain"`
	} `json:"serialize"`
	HMAC struct {
		Token     string `json:"token"`
		Timestamp int64  `json:"timestamp"`
		Method    string `json:"method"`
		URL       string `json:"url"`
		Body      string `json:"body"`
		Header    string `json:"header"`
	} `json:"hmac"`
	Ed25519 struct {
		PrivateJWK    json.RawMessage `json:"privateJwk"`
		PublicJWK     json.RawMessage `json:"publicJwk"`
		KeyID         string          `json:"keyId"`
		Audience      string          `json:"audience"`
		Timestamp     int64           `json:"timestamp"`
		Nonce         string          `json:"nonce"`
		Method        string          `json:"method"`
		URL           string          `json:"url"`
		Authorization string          `json:"authorization"`
		Body          string          `json:"body"`
		Header        string          `json:"header"`
	} `json:"ed25519"`
}

func loadVectors(t *testing.T) vectors {
	t.Helper()
	data, err := os.ReadFile("testdata/vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	var v vectors
	if err := json.Unmarshal(data, &v); err != nil {
		t.Fatal(err)
	}
	return v
}

func decodeGeneric(t *testing.T, data []byte) any {
	t.Helper()
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		t.Fatalf("decode %s: %v", data, err)
	}
	return v
}

func assertJSONEqual(t *testing.T, got, want []byte) {
	t.Helper()
	if !reflect.DeepEqual(decodeGeneric(t, got), decodeGeneric(t, want)) {
		t.Fatalf("JSON mismatch\n got: %s\nwant: %s", got, want)
	}
}

func TestNormalizeTypeScriptVectors(t *testing.T) {
	for _, c := range loadVectors(t).Serialize {
		t.Run(c.Name, func(t *testing.T) {
			got, err := Normalize([]byte(c.Encoded))
			if err != nil {
				t.Fatal(err)
			}
			assertJSONEqual(t, got, []byte(c.Plain))
		})
	}
}

func TestNormalizePlainJSON(t *testing.T) {
	got, err := Normalize([]byte(`{"a":1}`))
	if err != nil {
		t.Fatal(err)
	}
	assertJSONEqual(t, got, []byte(`{"a":1}`))
}

func TestNormalizeRejectsNonFiniteNumbers(t *testing.T) {
	_, err := Normalize([]byte(`{"$$TYPES$$":{"__mode":"object","values":{"n":["number"]},"v":1},"n":"NaN"}`))
	if err == nil {
		t.Fatal("expected an error")
	}
}

type embedded struct {
	Region string `json:"region"`
}

type sample struct {
	embedded
	ID        string            `json:"id"`
	CreatedAt time.Time         `json:"createdAt"`
	DeletedAt *time.Time        `json:"deletedAt"`
	Optional  *string           `json:"optional,omitempty"`
	Labels    map[string]string `json:"labels"`
	History   []time.Time       `json:"history"`
	Nested    struct {
		At time.Time `json:"at.key"`
	} `json:"nested"`
	Raw     json.RawMessage `json:"raw"`
	Skipped string          `json:"-"`
	private string
}

func TestMarshalAnnotatesDates(t *testing.T) {
	at := time.Date(2026, 1, 2, 3, 4, 5, 6_000_000, time.FixedZone("x", 3600))
	v := sample{
		embedded:  embedded{Region: "eu"},
		ID:        "bkt_1",
		CreatedAt: at,
		DeletedAt: &at,
		Labels:    map[string]string{"a": "b"},
		History:   []time.Time{at},
		Raw:       json.RawMessage(`{"x":[1,2]}`),
		Skipped:   "nope",
		private:   "nope",
	}
	v.Nested.At = at

	encoded, err := Marshal(v)
	if err != nil {
		t.Fatal(err)
	}

	var doc map[string]json.RawMessage
	if err := json.Unmarshal(encoded, &doc); err != nil {
		t.Fatal(err)
	}

	assertJSONEqual(t, doc["$$TYPES$$"], []byte(`{
		"__mode": "object",
		"v": 1,
		"values": {
			"createdAt": ["Date"],
			"deletedAt": ["Date"],
			"history.0": ["Date"],
			"nested.at\\.key": ["Date"]
		}
	}`))

	plain, err := Normalize(encoded)
	if err != nil {
		t.Fatal(err)
	}
	assertJSONEqual(t, plain, []byte(`{
		"region": "eu",
		"id": "bkt_1",
		"createdAt": "2026-01-02T02:04:05.006Z",
		"deletedAt": "2026-01-02T02:04:05.006Z",
		"labels": {"a": "b"},
		"history": ["2026-01-02T02:04:05.006Z"],
		"nested": {"at.key": "2026-01-02T02:04:05.006Z"},
		"raw": {"x": [1, 2]}
	}`))

	var decoded sample
	if err := Unmarshal(encoded, &decoded); err != nil {
		t.Fatal(err)
	}
	if !decoded.CreatedAt.Equal(at) || !decoded.Nested.At.Equal(at) || decoded.Region != "eu" {
		t.Fatalf("round trip mismatch: %+v", decoded)
	}
}

func TestMarshalTopLevelShapes(t *testing.T) {
	cases := []struct {
		name  string
		value any
		want  string
	}{
		{"nil", nil, `{"$$TYPES$$":{"__mode":"object"}}`},
		{"empty object", struct{}{}, `{"$$TYPES$$":{"__mode":"value"},"data":{}}`},
		{"string", "hi", `{"$$TYPES$$":{"__mode":"value"},"data":"hi"}`},
		{"date", time.UnixMilli(0), `{"$$TYPES$$":{"__mode":"value","values":["Date"],"v":1},"data":"1970-01-01T00:00:00.000Z"}`},
		{"array", []any{1, time.UnixMilli(0)}, `{"$$TYPES$$":{"__mode":"object","values":{"items.1":["Date"]},"v":1},"items":[1,"1970-01-01T00:00:00.000Z"],"$$MODE$$":"array_envelope"}`},
		{"nan", map[string]float64{"n": math.NaN()}, `{"$$TYPES$$":{"__mode":"object","values":{"n":["number"]},"v":1},"n":"NaN"}`},
		{"error", NotFoundError("bucket", "bkt_1"), `{"$$TYPES$$":{"__mode":"object"},"object":"error","ok":false,"status":404,"code":"not_found","message":"The requested bucket could not be found.","hint":"Make sure the resource you are trying to access exists, that you have access to it and that it has not been deleted.","entity":"bucket","id":"bkt_1"}`},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, err := Marshal(c.value)
			if err != nil {
				t.Fatal(err)
			}
			assertJSONEqual(t, got, []byte(c.want))
		})
	}
}

func TestMarshalUnmarshalRoundTrip(t *testing.T) {
	type item struct {
		At   time.Time  `json:"at"`
		Tags []string   `json:"tags,omitempty"`
		Next *time.Time `json:"next,omitzero"`
	}
	in := map[string][]item{"a": {{At: time.UnixMilli(1234).UTC()}}}

	encoded, err := Marshal(in)
	if err != nil {
		t.Fatal(err)
	}

	var out map[string][]item
	if err := Unmarshal(encoded, &out); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(in, out) {
		t.Fatalf("got %+v, want %+v", out, in)
	}
}
