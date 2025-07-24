package util

func MapChan[A any, B any](in <-chan A, f func(A) B) <-chan B {
	out := make(chan B)
	go func() {
		defer close(out)
		for v := range in {
			out <- f(v)
		}
	}()
	return out
}
