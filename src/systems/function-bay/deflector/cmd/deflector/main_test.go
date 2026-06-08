package main

import "testing"

func TestEnvBool(t *testing.T) {
	t.Setenv("DEFLECTOR_TEST_BOOL", "true")
	if !envBool("DEFLECTOR_TEST_BOOL", false) {
		t.Fatal("expected true value to be parsed")
	}

	t.Setenv("DEFLECTOR_TEST_BOOL", "false")
	if envBool("DEFLECTOR_TEST_BOOL", true) {
		t.Fatal("expected false value to be parsed")
	}

	t.Setenv("DEFLECTOR_TEST_BOOL", "not-bool")
	if !envBool("DEFLECTOR_TEST_BOOL", true) {
		t.Fatal("expected invalid value to return fallback")
	}
}
