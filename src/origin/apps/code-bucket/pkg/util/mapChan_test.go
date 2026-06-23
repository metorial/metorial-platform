package util

import (
	"reflect"
	"testing"
)

func TestMapChan_IntToString(t *testing.T) {
	in := make(chan int)
	go func() {
		defer close(in)
		for i := 1; i <= 3; i++ {
			in <- i
		}
	}()

	f := func(i int) string {
		return string(rune('a' + i - 1))
	}

	out := MapChan(in, f)
	var results []string
	for v := range out {
		results = append(results, v)
	}

	expected := []string{"a", "b", "c"}
	if !reflect.DeepEqual(results, expected) {
		t.Errorf("expected %v, got %v", expected, results)
	}
}

func TestMapChan_EmptyInput(t *testing.T) {
	in := make(chan int)
	close(in)

	f := func(i int) int { return i * 2 }
	out := MapChan(in, f)

	var results []int
	for v := range out {
		results = append(results, v)
	}

	if len(results) != 0 {
		t.Errorf("expected empty result, got %v", results)
	}
}

func TestMapChan_StringToLen(t *testing.T) {
	in := make(chan string)
	go func() {
		defer close(in)
		in <- "foo"
		in <- "barbaz"
	}()

	f := func(s string) int { return len(s) }
	out := MapChan(in, f)

	var results []int
	for v := range out {
		results = append(results, v)
	}

	expected := []int{3, 6}
	if !reflect.DeepEqual(results, expected) {
		t.Errorf("expected %v, got %v", expected, results)
	}
}
