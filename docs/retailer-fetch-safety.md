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
