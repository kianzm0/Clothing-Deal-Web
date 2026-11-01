# Bounded account inputs

Signup, preference writes and watchlist writes now validate JSON shape and values
before hashing or writing. Malformed JSON and invalid values return 400; oversized
bodies return 413; database failures return a generic 503. Concurrent duplicate signup
returns 409 using the database unique constraint rather than leaking a Prisma error.

Signup accepts normalized email (trim/lowercase, max 254), a string name (max 100),
and passwords of at least eight characters and at most 72 UTF-8 bytes. The upper
limit prevents bcrypt silently treating different new long passwords as identical.
Login normalizes email identically. Existing password hashes are not changed and
legacy long-password login behavior remains compatible.

Preferences require all five string lists (at most 100 items, 100 characters each),
finite budget 0–100,000 and discount 0–100. Unknown fields are stripped; relation
operators and numeric update objects are never forwarded. Product IDs must be
nonempty strings up to 200 characters. Deleting an unavailable saved product remains
supported. Body limits are 8 KiB/signup, 16 KiB/preferences and 1 KiB/watchlist,
measured from the stream rather than trusting Content-Length.

No migration is required. This is input hardening, not brute-force or signup-spam
protection. Shared rate limiting for login/registration and deployment-level abuse
controls are still needed; no in-process limiter is presented as serverless protection.
