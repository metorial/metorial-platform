package ldrpc

import (
	"bytes"
	"encoding"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"math"
	"reflect"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// The codec speaks the @lowerdeck/serialize envelope: SuperJSON output flattened into one
// JSON document with its type metadata under "$$TYPES$$". See PROTOCOL.md, "Body encoding".

const (
	typesKey          = "$$TYPES$$"
	modeKey           = "$$MODE$$"
	arrayEnvelopeMode = "array_envelope"
	jsTimeLayout      = "2006-01-02T15:04:05.000Z07:00"
)

var (
	timeType          = reflect.TypeFor[time.Time]()
	marshalerType     = reflect.TypeFor[json.Marshaler]()
	textMarshalerType = reflect.TypeFor[encoding.TextMarshaler]()
	unionValueType    = reflect.TypeFor[UnionValue]()
	errUndefined      = undefinedValue{}
)

type undefinedValue struct{}

// Marshal encodes v as a @lowerdeck/serialize document. time.Time values are tagged as
// "Date" so TypeScript receivers get Date objects back; non-finite floats are tagged as
// "number". Everything else is plain JSON, following encoding/json's struct tag rules.
func Marshal(v any) ([]byte, error) {
	enc := &encoder{annotations: map[string]string{}}

	tree, err := enc.value(reflect.ValueOf(v), nil)
	if err != nil {
		return nil, err
	}

	types := map[string]any{}
	doc := map[string]any{}

	switch t := tree.(type) {
	case nil:
		types["__mode"] = "object"

	case []any:
		types["__mode"] = "object"
		doc["items"] = t
		doc[modeKey] = arrayEnvelopeMode
		enc.prefix("items")

	case map[string]any:
		if len(t) == 0 {
			// An empty object in object mode is indistinguishable from null, and
			// @lowerdeck/rpc-client decodes it as null. Value mode keeps it an object.
			types["__mode"] = "value"
			doc["data"] = t
		} else {
			types["__mode"] = "object"
			maps.Copy(doc, t)
		}

	default:
		types["__mode"] = "value"
		doc["data"] = t
	}

	if len(enc.annotations) > 0 {
		types["v"] = 1
		if root, ok := enc.annotations[""]; ok {
			types["values"] = []any{root}
		} else {
			values := make(map[string]any, len(enc.annotations))
			for path, ann := range enc.annotations {
				values[path] = []any{ann}
			}
			types["values"] = values
		}
	}

	doc[typesKey] = types

	var buf bytes.Buffer
	jsonEnc := json.NewEncoder(&buf)
	jsonEnc.SetEscapeHTML(false)
	if err := jsonEnc.Encode(doc); err != nil {
		return nil, err
	}
	return bytes.TrimRight(buf.Bytes(), "\n"), nil
}

// Unmarshal decodes a @lowerdeck/serialize document into v. Plain JSON without an envelope
// is accepted as-is.
func Unmarshal(data []byte, v any) error {
	plain, err := Normalize(data)
	if err != nil {
		return err
	}
	return json.Unmarshal(plain, v)
}

// Normalize converts a @lowerdeck/serialize document into plain JSON: type annotations are
// applied (bigint becomes a JSON number, map becomes an object, undefined is dropped, Date
// stays an ISO-8601 string) and the envelope is removed.
func Normalize(data []byte) (json.RawMessage, error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()

	var root any
	if err := dec.Decode(&root); err != nil {
		return nil, fmt.Errorf("ldrpc: invalid JSON: %w", err)
	}

	obj, ok := root.(map[string]any)
	if !ok {
		return data, nil
	}

	types, ok := obj[typesKey].(map[string]any)
	if !ok || types["__mode"] == nil {
		return data, nil
	}

	mode, _ := obj[modeKey].(string)
	delete(obj, typesKey)
	delete(obj, modeKey)

	var value any = obj
	if types["__mode"] == "value" {
		value = obj["data"]
	}

	if values, has := types["values"]; has && values != nil {
		var err error
		value, err = applyTree(value, values)
		if err != nil {
			return nil, err
		}
	}

	if mode == arrayEnvelopeMode {
		if env, ok := value.(map[string]any); ok {
			if items, has := env["items"]; has {
				value = items
			}
		}
	}

	if value == errUndefined {
		value = nil
	}

	return json.Marshal(value)
}

func applyTree(node any, tree any) (any, error) {
	switch t := tree.(type) {
	case []any:
		if len(t) == 0 {
			return node, nil
		}

		if len(t) > 1 {
			children, ok := t[1].(map[string]any)
			if !ok {
				return nil, errors.New("ldrpc: invalid type annotation tree")
			}
			var err error
			if node, err = applyChildren(node, children); err != nil {
				return nil, err
			}
		}

		return applyAnnotation(node, t[0])

	case map[string]any:
		return applyChildren(node, t)

	default:
		return nil, errors.New("ldrpc: invalid type annotation tree")
	}
}

// Children are applied before the node's own annotation: a "map" annotation restructures
// its value, and child paths address the pre-conversion [[key, value], ...] layout.
func applyChildren(node any, children map[string]any) (any, error) {
	paths := make([]string, 0, len(children))
	for path := range children {
		paths = append(paths, path)
	}
	sort.Strings(paths)

	for _, path := range paths {
		var err error
		node, err = applyAtPath(node, parsePath(path), children[path])
		if err != nil {
			return nil, err
		}
	}

	return node, nil
}

func applyAtPath(node any, path []string, tree any) (any, error) {
	if len(path) == 0 {
		return applyTree(node, tree)
	}

	switch n := node.(type) {
	case map[string]any:
		child, ok := n[path[0]]
		if !ok {
			return nil, fmt.Errorf("ldrpc: type annotation path %q not found", path[0])
		}
		res, err := applyAtPath(child, path[1:], tree)
		if err != nil {
			return nil, err
		}
		if res == errUndefined {
			delete(n, path[0])
		} else {
			n[path[0]] = res
		}
		return n, nil

	case []any:
		i, err := strconv.Atoi(path[0])
		if err != nil || i < 0 || i >= len(n) {
			return nil, fmt.Errorf("ldrpc: type annotation index %q out of range", path[0])
		}
		res, err := applyAtPath(n[i], path[1:], tree)
		if err != nil {
			return nil, err
		}
		if res == errUndefined {
			res = nil
		}
		n[i] = res
		return n, nil

	default:
		return nil, fmt.Errorf("ldrpc: type annotation path %q does not address a container", path[0])
	}
}

func applyAnnotation(node any, ann any) (any, error) {
	name, ok := ann.(string)
	if !ok {
		// Composite annotations (class, custom, symbol, typed-array) keep their JSON form.
		return node, nil
	}

	switch name {
	case "undefined":
		return errUndefined, nil

	case "bigint":
		s, ok := node.(string)
		if !ok {
			return nil, errors.New("ldrpc: bigint annotation on non-string value")
		}
		if !isIntegerLiteral(s) {
			return nil, fmt.Errorf("ldrpc: invalid bigint %q", s)
		}
		return json.Number(s), nil

	case "number":
		return nil, errors.New("ldrpc: non-finite numbers (NaN, Infinity) are not supported")

	case "map":
		pairs, ok := node.([]any)
		if !ok {
			return nil, errors.New("ldrpc: map annotation on non-array value")
		}
		out := make(map[string]any, len(pairs))
		for _, p := range pairs {
			pair, ok := p.([]any)
			if !ok || len(pair) != 2 {
				return nil, errors.New("ldrpc: malformed map entry")
			}
			key, ok := pair[0].(string)
			if !ok {
				return nil, errors.New("ldrpc: only string-keyed maps are supported")
			}
			out[key] = pair[1]
		}
		return out, nil

	default:
		// Date stays an ISO-8601 string (time.Time unmarshals it), set stays an array, and
		// regexp/URL/Error keep their JSON form.
		return node, nil
	}
}

func isIntegerLiteral(s string) bool {
	digits := strings.TrimPrefix(s, "-")
	if digits == "" {
		return false
	}
	for _, r := range digits {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func parsePath(path string) []string {
	var segments []string
	var cur strings.Builder

	for i := 0; i < len(path); i++ {
		c := path[i]
		switch {
		case c == '\\' && i+1 < len(path):
			i++
			cur.WriteByte(path[i])
		case c == '.':
			segments = append(segments, cur.String())
			cur.Reset()
		default:
			cur.WriteByte(c)
		}
	}

	return append(segments, cur.String())
}

func escapePathSegment(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	return strings.ReplaceAll(s, ".", `\.`)
}

type encoder struct {
	annotations map[string]string
}

func (e *encoder) annotate(path []string, ann string) {
	escaped := make([]string, len(path))
	for i, seg := range path {
		escaped[i] = escapePathSegment(seg)
	}
	e.annotations[strings.Join(escaped, ".")] = ann
}

func (e *encoder) prefix(segment string) {
	prefixed := make(map[string]string, len(e.annotations))
	for path, ann := range e.annotations {
		if path == "" {
			prefixed[segment] = ann
		} else {
			prefixed[segment+"."+path] = ann
		}
	}
	e.annotations = prefixed
}

func (e *encoder) value(v reflect.Value, path []string) (any, error) {
	if !v.IsValid() {
		return nil, nil
	}

	if v.Type() == timeType {
		e.annotate(path, "Date")
		return v.Interface().(time.Time).UTC().Format(jsTimeLayout), nil
	}

	if (v.Kind() == reflect.Pointer || v.Kind() == reflect.Interface) && v.IsNil() {
		return nil, nil
	}

	if v.Kind() == reflect.Interface || (v.Kind() == reflect.Pointer && v.Type().Elem() == timeType) {
		return e.value(v.Elem(), path)
	}

	if v.Type().Implements(unionValueType) {
		return e.union(v.Interface().(UnionValue), path)
	}

	if raw, ok, err := marshalCustom(v); ok || err != nil {
		return raw, err
	}

	switch v.Kind() {
	case reflect.Pointer, reflect.Interface:
		return e.value(v.Elem(), path)

	case reflect.Struct:
		return e.structValue(v, path)

	case reflect.Map:
		if v.IsNil() {
			return nil, nil
		}
		out := make(map[string]any, v.Len())
		iter := v.MapRange()
		for iter.Next() {
			key, err := mapKey(iter.Key())
			if err != nil {
				return nil, err
			}
			child, err := e.value(iter.Value(), append(path, key))
			if err != nil {
				return nil, err
			}
			out[key] = child
		}
		return out, nil

	case reflect.Slice:
		if v.IsNil() {
			return nil, nil
		}
		if v.Type().Elem().Kind() == reflect.Uint8 {
			return base64.StdEncoding.EncodeToString(v.Bytes()), nil
		}
		return e.list(v, path)

	case reflect.Array:
		return e.list(v, path)

	case reflect.String:
		return v.String(), nil

	case reflect.Bool:
		return v.Bool(), nil

	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return v.Int(), nil

	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return v.Uint(), nil

	case reflect.Float32, reflect.Float64:
		f := v.Float()
		switch {
		case math.IsNaN(f):
			e.annotate(path, "number")
			return "NaN", nil
		case math.IsInf(f, 1):
			e.annotate(path, "number")
			return "Infinity", nil
		case math.IsInf(f, -1):
			e.annotate(path, "number")
			return "-Infinity", nil
		}
		if v.Kind() == reflect.Float32 {
			return float32(f), nil
		}
		return f, nil

	default:
		return nil, fmt.Errorf("ldrpc: cannot encode value of type %s", v.Type())
	}
}

func (e *encoder) union(u UnionValue, path []string) (any, error) {
	discriminator, tag, value := u.UnionVariant()
	if value == nil {
		return nil, nil
	}

	child, err := e.value(reflect.ValueOf(value), path)
	if err != nil {
		return nil, err
	}

	fields, ok := child.(map[string]any)
	if !ok && child != nil {
		return nil, fmt.Errorf("ldrpc: union variant %T must encode as an object", value)
	}
	if fields == nil {
		fields = map[string]any{}
	}
	fields[discriminator] = tag
	return fields, nil
}

func (e *encoder) list(v reflect.Value, path []string) (any, error) {
	out := make([]any, v.Len())
	for i := range out {
		child, err := e.value(v.Index(i), append(path, strconv.Itoa(i)))
		if err != nil {
			return nil, err
		}
		out[i] = child
	}
	return out, nil
}

func (e *encoder) structValue(v reflect.Value, path []string) (any, error) {
	out := map[string]any{}

	for _, f := range cachedFields(v.Type()) {
		fv, ok := fieldByIndex(v, f.index)
		if !ok {
			continue
		}
		if f.omitEmpty && isEmptyValue(fv) {
			continue
		}
		if f.omitZero && isZeroValue(fv) {
			continue
		}
		if f.nonNil {
			if empty, ok := emptyForNil(fv); ok {
				out[f.name] = empty
				continue
			}
		}

		child, err := e.value(fv, append(path, f.name))
		if err != nil {
			return nil, err
		}
		out[f.name] = child
	}

	return out, nil
}

// emptyForNil is what an `ldrpc:"nonnil"` field sends instead of null when it is a nil slice
// or map: generated code tags required arrays, records and bytes this way.
func emptyForNil(v reflect.Value) (any, bool) {
	switch v.Kind() {
	case reflect.Map:
		if v.IsNil() {
			return map[string]any{}, true
		}
	case reflect.Slice:
		if v.IsNil() && v.Type().Elem().Kind() == reflect.Uint8 {
			return "", true
		}
		if v.IsNil() {
			return []any{}, true
		}
	}
	return nil, false
}

// Values with their own MarshalJSON/MarshalText are opaque to the annotator: their output is
// decoded back into a generic tree so the envelope can still be built around it.
func marshalCustom(v reflect.Value) (any, bool, error) {
	target := v
	if !v.Type().Implements(marshalerType) && !v.Type().Implements(textMarshalerType) {
		if !v.CanAddr() {
			return nil, false, nil
		}
		target = v.Addr()
	}

	if m, ok := target.Interface().(json.Marshaler); ok {
		raw, err := m.MarshalJSON()
		if err != nil {
			return nil, true, err
		}
		dec := json.NewDecoder(bytes.NewReader(raw))
		dec.UseNumber()
		var out any
		if err := dec.Decode(&out); err != nil {
			return nil, true, err
		}
		return out, true, nil
	}

	if m, ok := target.Interface().(encoding.TextMarshaler); ok {
		text, err := m.MarshalText()
		if err != nil {
			return nil, true, err
		}
		return string(text), true, nil
	}

	return nil, false, nil
}

func mapKey(k reflect.Value) (string, error) {
	if k.Kind() == reflect.String {
		return k.String(), nil
	}
	if m, ok := k.Interface().(encoding.TextMarshaler); ok {
		text, err := m.MarshalText()
		return string(text), err
	}
	switch k.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return strconv.FormatInt(k.Int(), 10), nil
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr:
		return strconv.FormatUint(k.Uint(), 10), nil
	}
	return "", fmt.Errorf("ldrpc: unsupported map key type %s", k.Type())
}

func fieldByIndex(v reflect.Value, index []int) (reflect.Value, bool) {
	for i, x := range index {
		if i > 0 && v.Kind() == reflect.Pointer {
			if v.IsNil() {
				return reflect.Value{}, false
			}
			v = v.Elem()
		}
		v = v.Field(x)
	}
	return v, true
}

func isEmptyValue(v reflect.Value) bool {
	switch v.Kind() {
	case reflect.Array, reflect.Map, reflect.Slice, reflect.String:
		return v.Len() == 0
	case reflect.Bool, reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64,
		reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64, reflect.Uintptr,
		reflect.Float32, reflect.Float64, reflect.Interface, reflect.Pointer:
		return v.IsZero()
	}
	return false
}

func isZeroValue(v reflect.Value) bool {
	if z, ok := v.Interface().(interface{ IsZero() bool }); ok {
		if (v.Kind() == reflect.Pointer || v.Kind() == reflect.Interface) && v.IsNil() {
			return true
		}
		return z.IsZero()
	}
	return v.IsZero()
}

type field struct {
	name      string
	index     []int
	depth     int
	omitEmpty bool
	omitZero  bool
	nonNil    bool
}

var fieldCache sync.Map

func cachedFields(t reflect.Type) []field {
	if f, ok := fieldCache.Load(t); ok {
		return f.([]field)
	}
	f := typeFields(t)
	fieldCache.Store(t, f)
	return f
}

// typeFields follows encoding/json for the common cases: tag names, "-", omitempty,
// omitzero and promotion of untagged embedded structs, with the shallowest field winning a
// name conflict.
func typeFields(t reflect.Type) []field {
	var all []field

	var walk func(t reflect.Type, index []int, depth int, visited map[reflect.Type]bool)
	walk = func(t reflect.Type, index []int, depth int, visited map[reflect.Type]bool) {
		if visited[t] {
			return
		}
		visited[t] = true
		defer delete(visited, t)

		for i := 0; i < t.NumField(); i++ {
			sf := t.Field(i)
			tag := sf.Tag.Get("json")
			if tag == "-" {
				continue
			}

			name, opts, _ := strings.Cut(tag, ",")
			idx := append(append([]int{}, index...), i)

			if sf.Anonymous && name == "" {
				ft := sf.Type
				if ft.Kind() == reflect.Pointer {
					ft = ft.Elem()
				}
				if ft.Kind() == reflect.Struct {
					walk(ft, idx, depth+1, visited)
					continue
				}
			}

			if !sf.IsExported() {
				continue
			}
			if name == "" {
				name = sf.Name
			}

			all = append(all, field{
				name:      name,
				index:     idx,
				depth:     depth,
				omitEmpty: hasOption(opts, "omitempty"),
				omitZero:  hasOption(opts, "omitzero"),
				nonNil:    hasOption(sf.Tag.Get("ldrpc"), "nonnil"),
			})
		}
	}
	walk(t, nil, 0, map[reflect.Type]bool{})

	sort.SliceStable(all, func(i, j int) bool { return all[i].depth < all[j].depth })

	seen := map[string]bool{}
	out := make([]field, 0, len(all))
	for _, f := range all {
		if seen[f.name] {
			continue
		}
		seen[f.name] = true
		out = append(out, f)
	}

	sort.SliceStable(out, func(i, j int) bool {
		return lessIndex(out[i].index, out[j].index)
	})
	return out
}

func lessIndex(a, b []int) bool {
	for i := 0; i < len(a) && i < len(b); i++ {
		if a[i] != b[i] {
			return a[i] < b[i]
		}
	}
	return len(a) < len(b)
}

func hasOption(opts, name string) bool {
	for opts != "" {
		var opt string
		opt, opts, _ = strings.Cut(opts, ",")
		if opt == name {
			return true
		}
	}
	return false
}
