package ldrpc

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf16"
)

// Schemas validate call inputs exactly like @lowerdeck/validation would, so a Go server
// answers malformed input with the same 400 invalid_data issues as a TypeScript server.
// The schema language is the @lowerdeck/rpc-spec IR (its named types, by name); generated
// code embeds the input types of a service and passes them to Unary via WithInputSchema.
//
// Validation runs on the decoded JSON tree, before encoding/json sees the payload: it
// detects missing keys, applies @lowerdeck/validation's coercions ("12" for a number,
// "true" for a boolean, any parseable date string) and produces the normalized payload
// that is then unmarshalled into the input struct.

const (
	maxSafeInteger  = 1<<53 - 1
	maxStringLength = 100_000
)

type Schemas struct {
	types map[string]*schemaType
}

type Schema struct {
	root *schemaType
}

type schemaField struct {
	Name     string      `json:"name"`
	Type     *schemaType `json:"type"`
	Optional bool        `json:"optional"`
}

type schemaVariant struct {
	Tag  string `json:"tag"`
	Type string `json:"type"`
}

type schemaType struct {
	Kind          string          `json:"kind"`
	Name          string          `json:"name"`
	Type          *schemaType     `json:"type"`
	MinLength     *int            `json:"minLength"`
	MaxLength     *int            `json:"maxLength"`
	Pattern       *string         `json:"pattern"`
	Format        string          `json:"format"`
	Min           *float64        `json:"min"`
	Max           *float64        `json:"max"`
	Value         json.RawMessage `json:"value"`
	Items         *schemaType     `json:"items"`
	Values        json.RawMessage `json:"values"`
	Fields        []schemaField   `json:"fields"`
	Discriminator string          `json:"discriminator"`
	Variants      []schemaVariant `json:"variants"`

	ref         *schemaType
	enumValues  []string
	recordValue *schemaType
	literal     any
	regex       *regexp.Regexp
	variants    []*schemaType
}

func ParseSchemas(data string) (*Schemas, error) {
	var types map[string]*schemaType
	if err := json.Unmarshal([]byte(data), &types); err != nil {
		return nil, fmt.Errorf("ldrpc: invalid schemas: %w", err)
	}

	s := &Schemas{types: types}
	for name, t := range types {
		if err := s.resolve(t); err != nil {
			return nil, fmt.Errorf("ldrpc: schema %s: %w", name, err)
		}
	}
	return s, nil
}

func MustParseSchemas(data string) *Schemas {
	s, err := ParseSchemas(data)
	if err != nil {
		panic(err)
	}
	return s
}

// Type returns the named schema. It panics for unknown names, which only happens when
// generated code and its embedded schemas disagree.
func (s *Schemas) Type(name string) *Schema {
	t, ok := s.types[name]
	if !ok {
		panic(fmt.Sprintf("ldrpc: unknown schema %q", name))
	}
	return &Schema{root: t}
}

func (s *Schemas) resolve(t *schemaType) error {
	if t == nil {
		return errors.New("missing type")
	}

	switch t.Kind {
	case "ref":
		ref, ok := s.types[t.Name]
		if !ok {
			return fmt.Errorf("unknown type %q", t.Name)
		}
		t.ref = ref

	case "nullable", "alias":
		return s.resolve(t.Type)

	case "string":
		if t.Pattern != nil {
			re, err := regexp.Compile(*t.Pattern)
			if err != nil {
				return fmt.Errorf("pattern %q: %w", *t.Pattern, err)
			}
			t.regex = re
		}

	case "literal":
		if err := json.Unmarshal(t.Value, &t.literal); err != nil {
			return fmt.Errorf("literal: %w", err)
		}

	case "array":
		return s.resolve(t.Items)

	case "record":
		t.recordValue = &schemaType{}
		if err := json.Unmarshal(t.Values, t.recordValue); err != nil {
			return fmt.Errorf("record values: %w", err)
		}
		return s.resolve(t.recordValue)

	case "enum":
		if err := json.Unmarshal(t.Values, &t.enumValues); err != nil {
			return fmt.Errorf("enum values: %w", err)
		}

	case "object":
		for _, f := range t.Fields {
			if err := s.resolve(f.Type); err != nil {
				return fmt.Errorf("field %s: %w", f.Name, err)
			}
		}

	case "union":
		for _, v := range t.Variants {
			variant, ok := s.types[v.Type]
			if !ok || variant.Kind != "object" {
				return fmt.Errorf("union variant %q is not an object type", v.Type)
			}
			lit, _ := json.Marshal(v.Tag)
			fields := append([]schemaField{{
				Name: t.Discriminator,
				Type: &schemaType{Kind: "literal", Value: lit, literal: v.Tag},
			}}, variant.Fields...)
			t.variants = append(t.variants, &schemaType{Kind: "object", Fields: fields})
		}

	case "boolean", "int", "number", "datetime", "bytes", "json", "void":

	default:
		return fmt.Errorf("unknown kind %q", t.Kind)
	}

	return nil
}

// Validate checks a plain JSON payload and returns it normalized: coerced values, unknown
// object keys removed. A failure is a ValidationErrors value.
func (s *Schema) Validate(payload json.RawMessage) (json.RawMessage, error) {
	var tree any = errUndefined
	if len(bytes.TrimSpace(payload)) > 0 {
		var err error
		if tree, err = parseTree(payload); err != nil {
			return nil, ValidationErrors{{Code: "invalid_type", Message: err.Error()}}
		}
	}

	value, issues := s.root.validate(tree)
	if len(issues) > 0 {
		return nil, ValidationErrors(issues)
	}

	var buf bytes.Buffer
	if value == errUndefined {
		value = nil
	}
	if err := encodeTree(&buf, value); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (t *schemaType) validate(value any) (any, []ValidationIssue) {
	switch t.Kind {
	case "ref":
		return t.ref.validate(value)

	case "alias":
		return t.Type.validate(value)

	case "nullable":
		if value == nil {
			return nil, nil
		}
		return t.Type.validate(value)

	case "json", "void":
		return value, nil

	case "string", "bytes":
		return t.validateString(value)

	case "int", "number":
		return t.validateNumber(value)

	case "boolean":
		switch v := value.(type) {
		case bool:
			return v, nil
		case string:
			if v == "true" || v == "false" {
				return v == "true", nil
			}
		}
		return nil, typeIssue(fmt.Sprintf("Invalid input, expected a boolean, received %s", jsTypeof(value)), jsTypeof(value), "boolean")

	case "datetime":
		if s, ok := value.(string); ok {
			if at, ok := parseJSDate(s); ok {
				return at.UTC().Format(jsTimeLayout), nil
			}
		}
		return nil, typeIssue(fmt.Sprintf("Invalid input, expected a date, received %s", jsTypeof(value)), jsTypeof(value), "date")

	case "literal":
		if !jsLooseEqual(value, t.literal) {
			return nil, []ValidationIssue{{
				Code:     "invalid_literal",
				Message:  fmt.Sprintf("Invalid input, expected %s, received %s", jsString(t.literal), jsString(value)),
				Received: plainValue(value),
				Expected: t.literal,
			}}
		}
		return treeValue(t.literal), nil

	case "enum":
		if s, ok := value.(string); ok {
			for _, allowed := range t.enumValues {
				if s == allowed {
					return s, nil
				}
			}
		}
		return nil, []ValidationIssue{{
			Code:     "invalid_enum",
			Message:  fmt.Sprintf("Invalid input, expected one of %s, received %s", strings.Join(t.enumValues, ", "), jsString(value)),
			Received: plainValue(value),
			Expected: t.enumValues,
		}}

	case "array":
		return t.validateArray(value)

	case "record":
		return t.validateRecord(value)

	case "object":
		return t.validateObject(value)

	case "union":
		var issues []ValidationIssue
		for _, variant := range t.variants {
			out, variantIssues := variant.validate(value)
			if len(variantIssues) == 0 {
				return out, nil
			}
			issues = append(issues, variantIssues...)
		}
		return nil, issues
	}

	return nil, []ValidationIssue{{Code: "invalid_type", Message: "Unable to validate value"}}
}

func typeIssue(message, received, expected string) []ValidationIssue {
	return []ValidationIssue{{Code: "invalid_type", Message: message, Received: received, Expected: expected}}
}

func (t *schemaType) validateString(value any) (any, []ValidationIssue) {
	s, ok := value.(string)
	if !ok {
		return nil, typeIssue(fmt.Sprintf("Invalid input, expected string, received %s", jsTypeof(value)), jsTypeof(value), "string")
	}

	length := jsLength(s)
	if length > maxStringLength {
		return nil, []ValidationIssue{{Code: "max_length", Message: "Input is too long"}}
	}

	var issues []ValidationIssue
	if t.MinLength != nil && length < *t.MinLength {
		issues = append(issues, minLengthIssue(*t.MinLength, length))
	}
	if t.MaxLength != nil && length > *t.MaxLength {
		issues = append(issues, maxLengthIssue(*t.MaxLength, length))
	}
	if t.regex != nil && !t.regex.MatchString(s) {
		issues = append(issues, ValidationIssue{
			Code:     "invalid_regex",
			Message:  fmt.Sprintf("Invalid regex, expected %s", jsRegexString(*t.Pattern)),
			Received: s,
		})
	}
	switch t.Format {
	case "email":
		if !emailPattern.MatchString(s) {
			issues = append(issues, ValidationIssue{Code: "invalid_email", Message: "Invalid email address"})
		}
	case "url":
		if !isJSURL(s) {
			issues = append(issues, ValidationIssue{Code: "invalid_url", Message: "Invalid URL", Received: s})
		}
	}

	if len(issues) > 0 {
		return nil, issues
	}
	return s, nil
}

func minLengthIssue(min, length int) ValidationIssue {
	m := float64(min)
	return ValidationIssue{
		Code:     "invalid_min_length",
		Message:  fmt.Sprintf("Invalid min length, expected %d", min),
		Expected: min,
		Received: length,
		Min:      &m,
	}
}

func maxLengthIssue(max, length int) ValidationIssue {
	m := float64(max)
	return ValidationIssue{
		Code:     "invalid_max_length",
		Message:  fmt.Sprintf("Invalid max length, expected %d", max),
		Expected: max,
		Received: length,
		Max:      &m,
	}
}

// Modifiers (integer, min, max) see the value before coercion, as in @lowerdeck/validation:
// "5" passes as a number but always fails integer().
func (t *schemaType) validateNumber(value any) (any, []ValidationIssue) {
	var n float64
	var ok bool
	switch v := value.(type) {
	case json.Number:
		n, ok = jsonNumberFloat(v), true
	case string:
		n, ok = jsParseFloat(v)
	}
	if !ok {
		return nil, typeIssue(fmt.Sprintf("Invalid input, expected number, received %s", jsTypeof(value)), jsTypeof(value), "number")
	}

	original, isNumber := value.(json.Number)
	compared := n
	if !isNumber {
		compared = jsToNumber(value.(string))
	}

	min, max := t.Min, t.Max
	if t.Kind == "int" {
		lo, hi := float64(-maxSafeInteger), float64(maxSafeInteger)
		if min == nil {
			min = &lo
		}
		if max == nil {
			max = &hi
		}
	}

	var issues []ValidationIssue
	if t.Kind == "int" && (!isNumber || n != math.Trunc(n)) {
		received := plainValue(value)
		issues = append(issues, ValidationIssue{
			Code:     "invalid_integer",
			Message:  "Invalid value, expected integer",
			Expected: received,
			Received: received,
		})
	}
	if min != nil && compared < *min {
		issues = append(issues, ValidationIssue{
			Code:     "invalid_min",
			Message:  fmt.Sprintf("Invalid min, expected %s", jsNumberString(*min)),
			Expected: *min,
			Received: plainValue(value),
			Min:      min,
		})
	}
	if max != nil && compared > *max {
		issues = append(issues, ValidationIssue{
			Code:     "invalid_max",
			Message:  fmt.Sprintf("Invalid max, expected %s", jsNumberString(*max)),
			Expected: *max,
			Received: plainValue(value),
			Max:      max,
		})
	}
	if len(issues) > 0 {
		return nil, issues
	}

	if t.Kind == "int" {
		return json.Number(strconv.FormatInt(int64(n), 10)), nil
	}
	if isNumber {
		return original, nil
	}
	return json.Number(jsNumberString(n)), nil
}

func (t *schemaType) validateArray(value any) (any, []ValidationIssue) {
	items, ok := value.([]any)
	if !ok {
		return nil, typeIssue(fmt.Sprintf("Invalid input, expected array, received %s", jsTypeof(value)), jsTypeof(value), "array")
	}

	out := make([]any, len(items))
	for i, item := range items {
		v, issues := t.Items.validate(item)
		if len(issues) > 0 {
			return nil, prefixIssues(issues, strconv.Itoa(i))
		}
		if v == errUndefined {
			v = nil
		}
		out[i] = v
	}

	var issues []ValidationIssue
	if t.MinLength != nil && len(items) < *t.MinLength {
		issues = append(issues, minLengthIssue(*t.MinLength, len(items)))
	}
	if t.MaxLength != nil && len(items) > *t.MaxLength {
		issues = append(issues, maxLengthIssue(*t.MaxLength, len(items)))
	}
	if len(issues) > 0 {
		return nil, issues
	}
	return out, nil
}

func (t *schemaType) validateRecord(value any) (any, []ValidationIssue) {
	obj, ok := value.(*jsObject)
	if !ok {
		return nil, []ValidationIssue{{
			Code:     "invalid_type",
			Message:  "Invalid input, expected object",
			Received: plainValue(value),
			Expected: "object",
		}}
	}

	out := &jsObject{values: make(map[string]any, len(obj.keys))}
	for _, key := range obj.enumerationOrder() {
		v, issues := t.recordValue.validate(obj.values[key])
		if len(issues) > 0 {
			return nil, prefixIssues(issues, key)
		}
		out.set(key, v)
	}
	return out, nil
}

func (t *schemaType) validateObject(value any) (any, []ValidationIssue) {
	obj, ok := value.(*jsObject)
	if !ok {
		received := jsTypeof(value)
		if _, isArray := value.([]any); isArray {
			received = "array"
		}
		return nil, typeIssue(fmt.Sprintf("Invalid input, expected object, received %s", jsTypeof(value)), received, "object")
	}

	out := &jsObject{values: make(map[string]any, len(t.Fields))}
	for _, f := range t.Fields {
		fieldValue, present := obj.values[f.Name]
		if !present {
			fieldValue = errUndefined
		}
		if f.Optional && fieldValue == errUndefined {
			continue
		}

		v, issues := f.Type.validate(fieldValue)
		if len(issues) > 0 {
			return nil, prefixIssues(issues, f.Name)
		}
		out.set(f.Name, v)
	}
	return out, nil
}

func prefixIssues(issues []ValidationIssue, segment string) []ValidationIssue {
	out := make([]ValidationIssue, len(issues))
	for i, issue := range issues {
		issue.Path = append([]string{segment}, issue.Path...)
		out[i] = issue
	}
	return out
}

// jsObject keeps key order, which decides which failing record entry is reported first.
type jsObject struct {
	keys   []string
	values map[string]any
}

func (o *jsObject) set(key string, value any) {
	if value == errUndefined {
		return
	}
	if _, exists := o.values[key]; !exists {
		o.keys = append(o.keys, key)
	}
	o.values[key] = value
}

// enumerationOrder follows Object.entries: array-index keys ascending, then the rest in
// insertion order.
func (o *jsObject) enumerationOrder() []string {
	var indices, rest []string
	for _, key := range o.keys {
		if isArrayIndex(key) {
			indices = append(indices, key)
		} else {
			rest = append(rest, key)
		}
	}
	sort.SliceStable(indices, func(i, j int) bool {
		a, _ := strconv.ParseUint(indices[i], 10, 64)
		b, _ := strconv.ParseUint(indices[j], 10, 64)
		return a < b
	})
	return append(indices, rest...)
}

func isArrayIndex(key string) bool {
	if key == "" || (len(key) > 1 && key[0] == '0') {
		return false
	}
	n, err := strconv.ParseUint(key, 10, 64)
	return err == nil && n < math.MaxUint32
}

func parseTree(data []byte) (any, error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()

	value, err := parseTreeValue(dec)
	if err != nil {
		return nil, err
	}
	if _, err := dec.Token(); err != io.EOF {
		return nil, errors.New("invalid JSON: trailing data")
	}
	return value, nil
}

func parseTreeValue(dec *json.Decoder) (any, error) {
	tok, err := dec.Token()
	if err != nil {
		return nil, fmt.Errorf("invalid JSON: %w", err)
	}

	switch tok {
	case json.Delim('{'):
		obj := &jsObject{values: map[string]any{}}
		for dec.More() {
			keyTok, err := dec.Token()
			if err != nil {
				return nil, fmt.Errorf("invalid JSON: %w", err)
			}
			value, err := parseTreeValue(dec)
			if err != nil {
				return nil, err
			}
			obj.set(keyTok.(string), value)
		}
		if _, err := dec.Token(); err != nil {
			return nil, fmt.Errorf("invalid JSON: %w", err)
		}
		return obj, nil

	case json.Delim('['):
		items := []any{}
		for dec.More() {
			value, err := parseTreeValue(dec)
			if err != nil {
				return nil, err
			}
			items = append(items, value)
		}
		if _, err := dec.Token(); err != nil {
			return nil, fmt.Errorf("invalid JSON: %w", err)
		}
		return items, nil
	}

	return tok, nil
}

func encodeTree(buf *bytes.Buffer, value any) error {
	switch v := value.(type) {
	case nil:
		buf.WriteString("null")
	case bool:
		buf.WriteString(strconv.FormatBool(v))
	case json.Number:
		buf.WriteString(string(v))
	case string:
		encoded, err := json.Marshal(v)
		if err != nil {
			return err
		}
		buf.Write(encoded)
	case []any:
		buf.WriteByte('[')
		for i, item := range v {
			if i > 0 {
				buf.WriteByte(',')
			}
			if err := encodeTree(buf, item); err != nil {
				return err
			}
		}
		buf.WriteByte(']')
	case *jsObject:
		buf.WriteByte('{')
		for i, key := range v.keys {
			if i > 0 {
				buf.WriteByte(',')
			}
			encodedKey, _ := json.Marshal(key)
			buf.Write(encodedKey)
			buf.WriteByte(':')
			if err := encodeTree(buf, v.values[key]); err != nil {
				return err
			}
		}
		buf.WriteByte('}')
	default:
		return fmt.Errorf("ldrpc: cannot encode %T", value)
	}
	return nil
}

func treeValue(v any) any {
	switch x := v.(type) {
	case float64:
		return json.Number(jsNumberString(x))
	default:
		return x
	}
}

// jsonNull is a received/expected value that was JSON null (nil means "absent").
type jsonNull struct{}

func (jsonNull) MarshalJSON() ([]byte, error) { return []byte("null"), nil }

func plainValue(v any) any {
	if v == nil {
		return jsonNull{}
	}
	return plainNested(v)
}

func plainNested(v any) any {
	switch x := v.(type) {
	case undefinedValue:
		return nil
	case *jsObject:
		out := make(map[string]any, len(x.keys))
		for _, key := range x.keys {
			out[key] = plainNested(x.values[key])
		}
		return out
	case []any:
		out := make([]any, len(x))
		for i, item := range x {
			out[i] = plainNested(item)
		}
		return out
	default:
		return x
	}
}

func jsTypeof(v any) string {
	switch v.(type) {
	case undefinedValue:
		return "undefined"
	case bool:
		return "boolean"
	case json.Number, float64:
		return "number"
	case string:
		return "string"
	default:
		return "object"
	}
}

// jsString is String(value) as a template literal prints it.
func jsString(v any) string {
	switch x := v.(type) {
	case undefinedValue:
		return "undefined"
	case nil:
		return "null"
	case bool:
		return strconv.FormatBool(x)
	case json.Number:
		return jsNumberString(jsonNumberFloat(x))
	case float64:
		return jsNumberString(x)
	case string:
		return x
	case []any:
		parts := make([]string, len(x))
		for i, item := range x {
			if item != nil {
				parts[i] = jsString(item)
			}
		}
		return strings.Join(parts, ",")
	default:
		return "[object Object]"
	}
}

func jsonNumberFloat(n json.Number) float64 {
	f, err := strconv.ParseFloat(string(n), 64)
	if err != nil {
		var numErr *strconv.NumError
		if errors.As(err, &numErr) && errors.Is(numErr.Err, strconv.ErrRange) {
			return f
		}
		return math.NaN()
	}
	return f
}

// jsNumberString is Number.prototype.toString().
func jsNumberString(f float64) string {
	switch {
	case math.IsNaN(f):
		return "NaN"
	case math.IsInf(f, 1):
		return "Infinity"
	case math.IsInf(f, -1):
		return "-Infinity"
	case f == 0:
		return "0"
	}

	abs := math.Abs(f)
	if abs >= 1e-6 && abs < 1e21 {
		return strconv.FormatFloat(f, 'f', -1, 64)
	}

	s := strconv.FormatFloat(f, 'e', -1, 64)
	mantissa, exp, _ := strings.Cut(s, "e")
	sign := exp[0]
	digits := strings.TrimLeft(exp[1:], "0")
	return mantissa + "e" + string(sign) + digits
}

func jsLength(s string) int {
	n := 0
	for _, r := range s {
		n += utf16.RuneLen(r)
	}
	return n
}

var jsFloatPrefix = regexp.MustCompile(`^[+-]?(?:Infinity|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)`)

// jsParseFloat is parseFloat(). Results that would be Infinity count as unparseable since
// JSON can't carry them.
func jsParseFloat(s string) (float64, bool) {
	match := jsFloatPrefix.FindString(strings.TrimLeftFunc(s, isJSSpace))
	if match == "" || strings.Contains(match, "Infinity") {
		return 0, false
	}
	f, err := strconv.ParseFloat(match, 64)
	return f, err == nil
}

var jsDecimal = regexp.MustCompile(`^[+-]?(?:Infinity|(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$`)

// jsToNumber is Number(string), used where JavaScript compares a string with a number.
func jsToNumber(s string) float64 {
	s = strings.TrimFunc(s, isJSSpace)
	if s == "" {
		return 0
	}

	lower := strings.ToLower(s)
	for prefix, base := range map[string]int{"0x": 16, "0o": 8, "0b": 2} {
		if strings.HasPrefix(lower, prefix) {
			n, err := strconv.ParseUint(s[2:], base, 64)
			if err != nil {
				return math.NaN()
			}
			return float64(n)
		}
	}

	if !jsDecimal.MatchString(s) {
		return math.NaN()
	}
	switch strings.TrimLeft(s, "+") {
	case "Infinity":
		return math.Inf(1)
	case "-Infinity":
		return math.Inf(-1)
	}
	f, _ := strconv.ParseFloat(s, 64)
	return f
}

func isJSSpace(r rune) bool {
	return unicode.IsSpace(r) || r == '\uFEFF'
}

// jsLooseEqual is `input == literal` for a string, number or boolean literal.
func jsLooseEqual(input, literal any) bool {
	if b, ok := literal.(bool); ok {
		literal = boolNumber(b)
	}

	switch x := input.(type) {
	case undefinedValue, nil:
		return false
	case bool:
		return looseNumberEqual(boolNumber(x), literal)
	case json.Number:
		return looseNumberEqual(jsonNumberFloat(x), literal)
	case string:
		if s, ok := literal.(string); ok {
			return x == s
		}
		return jsToNumber(x) == literal.(float64)
	default:
		return jsLooseEqual(jsString(input), literal)
	}
}

func looseNumberEqual(n float64, literal any) bool {
	switch l := literal.(type) {
	case float64:
		return n == l
	case string:
		return n == jsToNumber(l)
	}
	return false
}

func boolNumber(b bool) float64 {
	if b {
		return 1
	}
	return 0
}

// jsRegexString is String(new RegExp(pattern)).
func jsRegexString(pattern string) string {
	if pattern == "" {
		return "/(?:)/"
	}

	var b strings.Builder
	inClass, escaped := false, false
	for _, r := range pattern {
		switch {
		case escaped:
			escaped = false
		case r == '\\':
			escaped = true
		case r == '[':
			inClass = true
		case r == ']':
			inClass = false
		case r == '/' && !inClass:
			b.WriteRune('\\')
		case r == '\n':
			b.WriteString(`\n`)
			continue
		case r == '\r':
			b.WriteString(`\r`)
			continue
		}
		b.WriteRune(r)
	}
	return "/" + b.String() + "/"
}

var emailPattern = regexp.MustCompile(`(?i)^[\w+-]+(?:\.[\w+-]+)*@[A-Z0-9]+(?:(?:\.|-)[A-Z0-9]+)*\.[A-Z]{2,}$`)

var (
	urlSchemePattern = regexp.MustCompile(`^[A-Za-z][A-Za-z0-9+.-]*:`)
	urlSpecialScheme = map[string]bool{"http": true, "https": true, "ws": true, "wss": true, "ftp": true}
	urlForbiddenHost = " #%/:<>?@[\\]^|"
)

// isJSURL approximates `new URL(value)` succeeding: a scheme is required, and special
// schemes (http, https, ws, wss, ftp) need a valid host and port.
func isJSURL(s string) bool {
	s = strings.TrimFunc(s, func(r rune) bool { return r <= ' ' })
	s = strings.NewReplacer("\t", "", "\n", "", "\r", "").Replace(s)

	scheme := urlSchemePattern.FindString(s)
	if scheme == "" {
		return false
	}
	name := strings.ToLower(strings.TrimSuffix(scheme, ":"))
	if !urlSpecialScheme[name] {
		return true
	}

	rest := strings.TrimLeft(s[len(scheme):], `/\`)
	authority := rest
	if i := strings.IndexAny(rest, `/\?#`); i >= 0 {
		authority = rest[:i]
	}
	if i := strings.LastIndex(authority, "@"); i >= 0 {
		authority = authority[i+1:]
	}

	host, port := authority, ""
	if strings.HasPrefix(host, "[") {
		end := strings.Index(host, "]")
		if end < 0 {
			return false
		}
		host, port = host[:end+1], strings.TrimPrefix(host[end+1:], ":")
		if host == "[]" {
			return false
		}
	} else if i := strings.LastIndex(host, ":"); i >= 0 {
		host, port = host[:i], host[i+1:]
	}

	if host == "" || (!strings.HasPrefix(host, "[") && strings.ContainsAny(host, urlForbiddenHost)) {
		return false
	}
	if port != "" {
		n, err := strconv.Atoi(port)
		if err != nil || n < 0 || n > 65535 {
			return false
		}
	}
	return true
}

var jsDatePattern = regexp.MustCompile(`^([+-]\d{6}|\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:?\d{2})?)?$`)

// parseJSDate accepts the ISO-8601 forms Date.parse understands. Forms without an offset
// are read as UTC (JavaScript reads date-times without one in local time, which is UTC on
// servers). Legacy formats like "Jan 1 2024" are not supported.
func parseJSDate(s string) (time.Time, bool) {
	m := jsDatePattern.FindStringSubmatch(s)
	if m == nil {
		return time.Time{}, false
	}

	num := func(v string, def int) int {
		if v == "" {
			return def
		}
		n, _ := strconv.Atoi(v)
		return n
	}

	year, month, day := num(m[1], 0), num(m[2], 1), num(m[3], 1)
	hour, minute, second := num(m[4], 0), num(m[5], 0), num(m[6], 0)
	if month < 1 || month > 12 || day < 1 || day > 31 || hour > 24 || minute > 59 || second > 59 {
		return time.Time{}, false
	}
	if hour == 24 && (minute != 0 || second != 0) {
		return time.Time{}, false
	}

	nanos := 0
	if frac := m[7]; frac != "" {
		frac = (frac + "000")[:3]
		nanos = num(frac, 0) * int(time.Millisecond)
	}

	loc := time.UTC
	if zone := m[8]; zone != "" && zone != "Z" {
		sign := 1
		if zone[0] == '-' {
			sign = -1
		}
		digits := strings.ReplaceAll(zone[1:], ":", "")
		offset := (num(digits[:2], 0)*60 + num(digits[2:], 0)) * 60
		loc = time.FixedZone("", sign*offset)
	}

	at := time.Date(year, time.Month(month), day, hour, minute, second, nanos, loc)
	if at.Day() != day && hour != 24 {
		return time.Time{}, false
	}
	return at, true
}
