# Retailer fetch safety

Retailer ingestion previously validated the initial hostname but let fetch follow
redirects automatically, including redirects outside the allowlist. It also buffered
unbounded HTML. All ingestion routes share the corrected scavenger fetcher.

- Require HTTPS, no embedded credentials, and the default HTTPS port.
- Disable redirect following entirely and return 422 with a final-URL instruction.
  Even same-host redirects are rejected. Editors must paste the final retailer URL;
  this deliberately trades some link convenience for a simple enforceable boundary.
- Reject declared or streamed HTML above 2 MiB, cancel the stream, and retain the
  existing timeout through body consumption. Compressed/chunked responses are bounded
  by actual bytes delivered by fetch, not just Content-Length.

Tests cover redirect destinations, URL forms, byte limits, cancellation and timeouts.
No database migration or environment change is required. This closes the automatic
redirect bypass; it is not a claim of complete SSRF prevention. DNS rebinding or a
compromised allowlisted retailer/subdomain still requires restricted network egress
or a DNS-pinned transport. Do not broaden the retailer allowlist to untrusted domains.


## Bulk extraction budget

`POST /api/deal-links` checks editorial access before reading its body. It accepts
an object containing `urls`, with these per-request limits:

- 64 KiB of actual UTF-8 request-body bytes, including unknown fields and JSON
  whitespace. Oversized Content-Length is rejected early; missing or understated
  headers cannot bypass streamed byte counting. Rejected streams are cancelled.
- 1–10 entries, each a nonempty string of at most 2,048 characters that parses as
  an absolute HTTP(S) URL. Invalid JSON, UTF-8, shapes, entries and counts return
  400; body overflow returns 413. Errors use `{ error: string }` and indexed entry
  errors identify the offending URL. Validate the entire batch before fetching.
- At most three active extraction workers per request. A worker starts another URL
  only after its current extraction settles. The shared scavenger still enforces
  HTTPS, credentials/port restrictions, the allowlist, no redirects, a 12-second
  fetch timeout and a 2 MiB HTML limit. No fetch protections are relaxed.

Accepted batches retain HTTP 207 and `{ results: [...] }`, including all-success
and all-failure batches. Results preserve input order and duplicate entries. Each
entry remains `{ url, ok: true, deal }` or `{ url, ok: false, error }`, using the
existing public scavenger error format. Retailer policy failures and fetch failures
are per-URL results and do not discard successful extractions or stop queued work.
Malformed URL syntax is a batch validation error; a syntactically valid URL that
fails retailer policy (for example HTTP or an unlisted host) is a per-URL error.

Clients sending larger batches must split them into batches of at most ten and
submit those batches sequentially. The cap bounds accepted retailer HTML to at
most 20 MiB per request, with at most three responses being fetched concurrently;
this is not a bound on all process memory or network buffering. Ten timeouts can
require four waves (roughly 48 seconds plus processing/overhead), so deployment
request-duration limits may still interrupt a batch. There is no global or
cross-request rate limiter; multiple authorized requests multiply the budget.
No infrastructure configuration, account changes or database migration is required.

`lib/deal-links.test.ts` tests parsing and worker behavior with controlled streams
and deferred promises. `lib/deal-links-api.test.ts` exercises the real handler,
authorization ordering and mixed responses with mocked session/database/network
boundaries. Existing scavenger tests continue covering redirects, sizes and timeouts.
