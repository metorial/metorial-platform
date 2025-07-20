package id

import "strings"

type IdGenerator interface {
	Prefix() string
	Length() int
}

type idGeneratorImpl struct {
	prefix string
	length int
}

func NewIdGenerator(gen IdGenerator) *idGeneratorImpl {
	length := gen.Length()
	prefix := gen.Prefix()

	if length <= 0 {
		length = 20
	}

	if !strings.HasSuffix(prefix, "_") && !strings.HasSuffix(prefix, "*") {
		prefix += "-"
	}

	return &idGeneratorImpl{
		prefix: prefix,
		length: length,
	}
}

func (g *idGeneratorImpl) Generate() (string, error) {
	id, err := GenerateID(g.length)
	if err != nil {
		return "", err
	}
	return g.prefix + id, nil
}
