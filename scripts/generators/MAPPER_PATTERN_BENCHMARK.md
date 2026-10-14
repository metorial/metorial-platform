# Mapper pattern measurements

Measured on 2026-10-14 using Bun 1.2.22 on macOS arm64. Baseline and every variant were regenerated
from the same captured introspection responses. Baseline uses the 3.1.0 runtime; all variants include
the complete 3.2.0 interpreter, so its overhead is included. Bundles contain every generated resource
and endpoint; `@metorial/util-endpoint` and `jose` are external in both. Source maps are excluded.

## Combined result

| Client    | Minified bytes, baseline → patterns | Gzip bytes, baseline → patterns | Brotli bytes, baseline → patterns |
| --------- | ----------------------------------: | ------------------------------: | --------------------------------: |
| dashboard |               1,636,574 → 1,489,830 |                101,298 → 99,626 |                   54,494 → 54,126 |
| consumer  |                   161,308 → 144,546 |                   9,815 → 9,633 |                     7,130 → 7,294 |
| node      |               1,378,338 → 1,254,354 |                 84,436 → 83,281 |                   45,157 → 44,793 |

Aggregate minified size falls by 9.0%, gzip by 1.5%, and Brotli by 0.5%. Consumer Brotli grows by
164 bytes (2.3%), while its gzip size decreases by 182 bytes. This is within the benchmark’s
explicit 256-byte per-client compression regression budget; these changes are not claimed to
improve every compression format for every client.

The final output contains 933 date-filter descriptors, 990 list descriptors, and 949 timestamp-pair
descriptors. List descriptors incorporate standard pagination. Another 26,921 `_at` date fields use
string shorthand; the timestamp pairs account for the remaining 1,898 of the original 28,819 dates.

## Individual patterns and combinations

| Variant            | Minified bytes | Gzip bytes | Brotli bytes |
| ------------------ | -------------: | ---------: | -----------: |
| baseline           |      3,176,220 |    195,549 |      106,781 |
| disabled           |      3,177,516 |    196,197 |      107,187 |
| dates              |      3,012,394 |    193,969 |      106,715 |
| date-filter        |      3,153,258 |    195,895 |      107,132 |
| pagination         |      3,138,906 |    195,695 |      107,017 |
| lists              |      3,106,416 |    194,931 |      106,707 |
| timestamps         |      3,138,138 |    195,485 |      107,010 |
| without-filters    |      2,912,988 |    192,900 |      106,180 |
| without-pagination |      2,888,730 |    192,540 |      106,213 |
| without-lists      |      2,921,220 |    192,934 |      106,111 |
| without-timestamps |      2,917,036 |    193,048 |      106,273 |
| all                |      2,888,730 |    192,540 |      106,213 |

Each individual pattern reduces both aggregate gzip and Brotli bytes against the registry-disabled
3.2.0 runtime. Removing filters, lists, or timestamp pairs from the combined output increases gzip
size and increases gzip-plus-Brotli bytes. Some marginal Brotli results favor removing a pattern by
a few dozen bytes; compressed size is not monotonic in the number of descriptors.

`without-pagination` equals `all` because the list matcher recognizes canonical pagination and
the list opcode incorporates its mapping. Pagination remains useful as a standalone pattern and
as shared runtime support for list mappings.

## Performance and verification

| List operation | Baseline µs | Patterns µs |
| -------------- | ----------: | ----------: |
| initialization |       0.976 |       0.244 |
| transformFrom  |       9.915 |       8.373 |
| transformTo    |       8.767 |       7.501 |

Timing uses five rounds of 10,000 operations after warmup, reporting the median. The response
contains 100 items, each with a created/updated timestamp pair and raw metadata. Initialization is
about four times faster through shared compiled patterns. Transformation timings are microbenchmarks
and fluctuate with warmup and allocation; the transformation engine itself is unchanged.

Fixtures constructed from all 2,295 introspected types matched registry-disabled results in both
directions. Tests separately cover partial filters, invalid dates, nullable values, collisions,
raw records, unknown `_at` fields, and compatibility with existing compact calls.

See [generation and benchmark instructions](./README.md) to reproduce these measurements.
