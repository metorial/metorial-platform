package gitremote

import (
	"bufio"
	"bytes"
	"compress/zlib"
	"context"
	"crypto/sha1"
	"encoding/binary"
	"io"
	"testing"

	"github.com/go-git/go-git/v5/plumbing"
)

func pkt(s string) string {
	var b bytes.Buffer
	encodePacket(&b, "%s", s)
	return b.String()
}

func FuzzParseAdvertisement(f *testing.F) {
	sha := "1111111111111111111111111111111111111111"
	f.Add([]byte(pkt("# service=git-upload-pack\n") + "0000" +
		pkt(sha+" refs/heads/main\x00multi_ack side-band-64k shallow filter object-format=sha1\n") +
		pkt(sha+" refs/tags/v1\n") + "0000"))
	f.Add([]byte(pkt("# service=git-upload-pack\n") + "0000" + pkt("version 2\n") + pkt("agent=git/2\n") +
		pkt("ls-refs=unborn\n") + pkt("fetch=shallow filter\n") + "0000"))
	f.Add([]byte(pkt("version 1\n") + pkt(ZeroSHA+" capabilities^{}\x00report-status\n") + "0000"))
	f.Add([]byte("0001000200zz"))

	f.Fuzz(func(t *testing.T, data []byte) {
		adv, err := ParseAdvertisement(bytes.NewReader(data), ServiceUploadPack)
		if err != nil {
			return
		}
		for name, sha := range adv.Refs {
			if !isSHA(sha) || name == "" {
				t.Fatalf("accepted bad ref %q %q", name, sha)
			}
		}
	})
}

func FuzzParseLsRefs(f *testing.F) {
	f.Add([]byte(pkt("1111111111111111111111111111111111111111 refs/heads/main symref-target:x\n") + "0000"))
	f.Add([]byte("0001"))
	f.Add([]byte("0005x"))

	f.Fuzz(func(t *testing.T, data []byte) {
		_, _ = parseLsRefs(bytes.NewReader(data))
	})
}

func FuzzReadFetchResponse(f *testing.F) {
	packData := buildPack(f, []rawObject{{plumbing.BlobObject, []byte("x")}})
	sideband := func(b []byte) string { return pkt("\x01" + string(b)) }

	f.Add([]byte(pkt("shallow-info\n")+pkt("shallow 1111111111111111111111111111111111111111\n")+"0001"+pkt("packfile\n")+sideband(packData)+"0000"), true)
	f.Add([]byte(pkt("NAK\n")+string(packData)), false)
	f.Add([]byte(pkt("NAK\n")+pkt("\x02progress")+sideband(packData)+"0000"), false)
	f.Add([]byte(pkt("NAK\n")+pkt("\x03boom")), false)

	f.Fuzz(func(t *testing.T, data []byte, v2 bool) {
		s := &session{opts: FetchOptions{}.withDefaults(), adv: &Advertisement{Version: map[bool]int{true: 2, false: 0}[v2]}}
		var out bytes.Buffer
		_ = s.readPack(bufio.NewReader(bytes.NewReader(data)), &out, 1<<20)
		if out.Len() > 1<<20 {
			t.Fatalf("wrote %d bytes past the cap", out.Len())
		}
	})
}

func FuzzReadPack(f *testing.F) {
	tree := treeBytes(TreeEntry{Name: "a.txt", Mode: 0o100644, SHA: plumbing.ComputeHash(plumbing.BlobObject, []byte("a"))})
	treeSHA := plumbing.ComputeHash(plumbing.TreeObject, tree)
	commit := []byte("tree " + treeSHA.String() + "\nauthor a <a> 0 +0000\ncommitter a <a> 0 +0000\n\nm\n")
	f.Add(buildPack(f, []rawObject{{plumbing.CommitObject, commit}, {plumbing.TreeObject, tree}}), plumbing.ComputeHash(plumbing.CommitObject, commit).String())
	f.Add([]byte("PACK\x00\x00\x00\x02\xff\xff\xff\xff"), "")

	f.Fuzz(func(t *testing.T, data []byte, head string) {
		limits := packLimits{MaxObjects: 1000, MaxObjectBytes: 1 << 20, MaxInflatedBytes: 4 << 20}
		store, err := readPackObjects(context.Background(), bytes.NewReader(data), limits)
		if err != nil {
			return
		}
		if isSHA(head) {
			if state, err := buildState(store, head, nil); err == nil {
				_, _ = state.Listing(10_000)
			}
		}
	})
}

func FuzzParseTree(f *testing.F) {
	f.Add(treeBytes(TreeEntry{Name: "a", Mode: 0o40000}, TreeEntry{Name: "b", Mode: 0o100755}))
	f.Add([]byte("100644 \x00"))

	f.Fuzz(func(t *testing.T, data []byte) {
		entries, err := parseTree(data)
		if err != nil {
			return
		}
		for _, e := range entries {
			if e.Name == "" || bytes.ContainsAny([]byte(e.Name), "/\x00") {
				t.Fatalf("accepted name %q", e.Name)
			}
		}
	})
}

func TestPackTreeBombIsCapped(t *testing.T) {
	leaf := treeBytes(TreeEntry{Name: "f", Mode: 0o100644, SHA: plumbing.ComputeHash(plumbing.BlobObject, nil)})
	leafSHA := plumbing.ComputeHash(plumbing.TreeObject, leaf)

	objects := []rawObject{{plumbing.TreeObject, leaf}}
	current := leafSHA
	for level := 0; level < 6; level++ {
		var entries []TreeEntry
		for i := 0; i < 20; i++ {
			entries = append(entries, TreeEntry{Name: string(rune('a' + i)), Mode: 0o40000, SHA: current})
		}
		tree := treeBytes(entries...)
		current = plumbing.ComputeHash(plumbing.TreeObject, tree)
		objects = append(objects, rawObject{plumbing.TreeObject, tree})
	}
	commit := []byte("tree " + current.String() + "\n\nm\n")
	objects = append(objects, rawObject{plumbing.CommitObject, commit})

	store, err := readPackObjects(context.Background(), bytes.NewReader(buildPack(t, objects)), packLimits{MaxObjects: 100, MaxObjectBytes: 1 << 20, MaxInflatedBytes: 1 << 20})
	if err != nil {
		t.Fatal(err)
	}
	state, err := buildState(store, plumbing.ComputeHash(plumbing.CommitObject, commit).String(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := state.Listing(100_000); err == nil {
		t.Fatal("expected the 64M-entry tree to hit the entry cap")
	}
}

func TestPackZipBombIsCapped(t *testing.T) {
	huge := bytes.Repeat([]byte{0}, 8<<20)
	data := buildPack(t, []rawObject{{plumbing.BlobObject, huge}})
	if len(data) > 64<<10 {
		t.Fatalf("pack is %d bytes", len(data))
	}

	_, err := readPackObjects(context.Background(), bytes.NewReader(data), packLimits{MaxObjects: 10, MaxObjectBytes: 1 << 20, MaxInflatedBytes: 1 << 20})
	if err == nil {
		t.Fatal("expected the inflated-bytes cap to trip")
	}
}

type rawObject struct {
	typ  plumbing.ObjectType
	data []byte
}

func treeBytes(entries ...TreeEntry) []byte { return EncodeTree(entries) }

func buildPack(tb testing.TB, objects []rawObject) []byte {
	tb.Helper()

	var b bytes.Buffer
	b.WriteString("PACK")
	_ = binary.Write(&b, binary.BigEndian, uint32(2))
	_ = binary.Write(&b, binary.BigEndian, uint32(len(objects)))
	for _, o := range objects {
		size := len(o.data)
		c := byte(o.typ)<<4 | byte(size&0x0f)
		size >>= 4
		for size > 0 {
			b.WriteByte(c | 0x80)
			c = byte(size & 0x7f)
			size >>= 7
		}
		b.WriteByte(c)
		z := zlib.NewWriter(&b)
		_, _ = io.Copy(z, bytes.NewReader(o.data))
		_ = z.Close()
	}
	sum := sha1.Sum(b.Bytes())
	b.Write(sum[:])
	return b.Bytes()
}
