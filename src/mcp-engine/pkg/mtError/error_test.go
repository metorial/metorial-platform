package mterror

import (
	"encoding/json"
	"errors"
	"testing"

	"google.golang.org/genproto/googleapis/rpc/errdetails"
	"google.golang.org/grpc/codes"
)

func TestError_Error(t *testing.T) {
	err := &MTError{Kind: InvalidRequestKind, Message: "bad input"}
	want := "invalid_request: bad input"
	if got := err.Error(); got != want {
		t.Errorf("Error() = %q, want %q", got, want)
	}
}

func TestError_MarshalJSON(t *testing.T) {
	err := &MTError{
		Kind:    ConflictKind,
		Message: "already exists",
		Details: map[string]string{"foo": "bar", "code": "custom_code"},
	}
	b, e := json.Marshal(err)
	if e != nil {
		t.Fatalf("MarshalJSON failed: %v", e)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		t.Fatalf("Unmarshal failed: %v", err)
	}
	if m["kind"] != string(ConflictKind) {
		t.Errorf("kind = %v, want %v", m["kind"], ConflictKind)
	}
	if m["message"] != "already exists" {
		t.Errorf("message = %v, want %v", m["message"], "already exists")
	}
	if m["foo"] != "bar" {
		t.Errorf("foo = %v, want %v", m["foo"], "bar")
	}
	if m["code"] != "custom_code" {
		t.Errorf("code = %v, want %v", m["code"], "custom_code")
	}
}

func TestNew(t *testing.T) {
	err := New(InternalErrorKind, "fail")
	if err.Kind != InternalErrorKind || err.Message != "fail" {
		t.Errorf("New() = %+v", err)
	}
}

func TestNewWithDetails(t *testing.T) {
	details := map[string]string{"foo": "bar"}
	err := NewWithDetails(TimeoutKind, "timeout", details)
	if err.Kind != TimeoutKind || err.Message != "timeout" || err.Details["foo"] != "bar" {
		t.Errorf("NewWithDetails() = %+v", err)
	}
}

func TestNewWithInnerError(t *testing.T) {
	inner := errors.New("inner")
	err := NewWithInnerError(ForbiddenKind, "forbidden", inner)
	if err.Kind != ForbiddenKind || err.Message != "forbidden" || err.inner != inner {
		t.Errorf("NewWithInnerError() = %+v", err)
	}
}

func TestNewWithInnerErrorAndDetails(t *testing.T) {
	inner := errors.New("inner")
	details := map[string]string{"foo": "bar"}
	err := NewWithInnerErrorAndDetails(NotFoundKind, "not found", inner, details)
	if err.Kind != NotFoundKind || err.Message != "not found" || err.inner != inner || err.Details["foo"] != "bar" {
		t.Errorf("NewWithInnerErrorAndDetails() = %+v", err)
	}
}

func TestNewWithCodeAndDetails(t *testing.T) {
	details := map[string]string{"foo": "bar"}
	err := NewWithCodeAndDetails(InternalErrorKind, "my_code", "fail", details)
	if err.Kind != InternalErrorKind || err.Message != "fail" || err.Details["foo"] != "bar" || err.Details["code"] != "my_code" {
		t.Errorf("NewWithCodeAndDetails() = %+v", err)
	}
}

func TestNewWithCodeAndInnerError(t *testing.T) {
	inner := errors.New("inner")
	err := NewWithCodeAndInnerError(InternalErrorKind, "my_code", "fail", inner)
	if err.Kind != InternalErrorKind || err.Message != "fail" || err.inner != inner || err.Details["code"] != "my_code" {
		t.Errorf("NewWithCodeAndInnerError() = %+v", err)
	}
}

func TestNewWithCodeAndInnerErrorAndDetails(t *testing.T) {
	inner := errors.New("inner")
	details := map[string]string{"foo": "bar"}
	err := NewWithCodeAndInnerErrorAndDetails(InternalErrorKind, "my_code", "fail", inner, details)
	if err.Kind != InternalErrorKind || err.Message != "fail" || err.inner != inner || err.Details["foo"] != "bar" || err.Details["code"] != "my_code" {
		t.Errorf("NewWithCodeAndInnerErrorAndDetails() = %+v", err)
	}
}

func TestUnwrap(t *testing.T) {
	inner := errors.New("inner")
	err := &MTError{inner: inner}
	if got := err.Unwrap(); got != inner {
		t.Errorf("Unwrap() = %v, want %v", got, inner)
	}
	if got := (&MTError{}).Unwrap(); got != nil {
		t.Errorf("Unwrap() = %v, want nil", got)
	}
}

func TestAsMTError(t *testing.T) {
	mt := New(UnknownErrorKind, "err")
	got, ok := AsMTError(mt)
	if !ok || got != mt {
		t.Errorf("AsMTError() failed for MTError")
	}
	_, ok = AsMTError(errors.New("not mt"))
	if ok {
		t.Errorf("AsMTError() should be false for non-MTError")
	}
}

func TestToGRPCStatus(t *testing.T) {
	err := NewWithDetails(InvalidRequestKind, "bad", map[string]string{"foo": "bar"})
	st := err.ToGRPCStatus()
	if st.Code() != codes.InvalidArgument {
		t.Errorf("ToGRPCStatus code = %v, want %v", st.Code(), codes.InvalidArgument)
	}
	if st.Message() != "bad" {
		t.Errorf("ToGRPCStatus message = %v, want %v", st.Message(), "bad")
	}
	details := st.Details()
	found := false
	for _, d := range details {
		if info, ok := d.(*errdetails.ErrorInfo); ok {
			found = true
			if info.Reason != string(InvalidRequestKind) {
				t.Errorf("ErrorInfo.Reason = %v, want %v", info.Reason, InvalidRequestKind)
			}
			if info.Metadata["foo"] != "bar" {
				t.Errorf("ErrorInfo.Metadata[foo] = %v, want bar", info.Metadata["foo"])
			}
			if info.Metadata["kind"] != string(InvalidRequestKind) {
				t.Errorf("ErrorInfo.Metadata[kind] = %v, want %v", info.Metadata["kind"], InvalidRequestKind)
			}
			if info.Metadata["message"] != "bad" {
				t.Errorf("ErrorInfo.Metadata[message] = %v, want bad", info.Metadata["message"])
			}
			if info.Metadata["code"] != string(InvalidRequestKind) {
				t.Errorf("ErrorInfo.Metadata[code] = %v, want %v", info.Metadata["code"], InvalidRequestKind)
			}
		}
	}
	if !found {
		t.Errorf("ErrorInfo not found in gRPC details")
	}
}

func TestToGRPCStatus_Nil(t *testing.T) {
	var err *MTError
	st := err.ToGRPCStatus()
	if st.Code() != codes.OK {
		t.Errorf("ToGRPCStatus(nil) = %v, want %v", st.Code(), codes.OK)
	}
}

func Test_mtErrorKindToGRPCCode(t *testing.T) {
	tests := []struct {
		kind ErrorKind
		want codes.Code
	}{
		{UnknownErrorKind, codes.Unknown},
		{InvalidRequestKind, codes.InvalidArgument},
		{InternalErrorKind, codes.Internal},
		{NotFoundKind, codes.NotFound},
		{ConflictKind, codes.AlreadyExists},
		{ForbiddenKind, codes.PermissionDenied},
		{TimeoutKind, codes.DeadlineExceeded},
		{"other", codes.Unknown},
	}
	for _, tt := range tests {
		if got := mtErrorKindToGRPCCode(tt.kind); got != tt.want {
			t.Errorf("mtErrorKindToGRPCCode(%v) = %v, want %v", tt.kind, got, tt.want)
		}
	}
}

func Test_cloneMap(t *testing.T) {
	orig := map[string]string{"a": "b"}
	clone := cloneMap(orig)
	if len(clone) != 1 || clone["a"] != "b" {
		t.Errorf("cloneMap() = %v, want %v", clone, orig)
	}
	clone["a"] = "c"
	if orig["a"] == "c" {
		t.Errorf("cloneMap() did not copy map, orig was mutated")
	}
	if got := cloneMap(nil); len(got) != 0 {
		t.Errorf("cloneMap(nil) = %v, want empty map", got)
	}
}
