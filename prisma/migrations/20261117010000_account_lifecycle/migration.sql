ALTER TABLE users ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0, ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
CREATE TABLE account_tokens (hash TEXT PRIMARY KEY, "userId" TEXT NOT NULL, purpose TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "account_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "account_tokens_userId_purpose_createdAt_idx" ON account_tokens("userId", purpose, "createdAt");
CREATE INDEX "account_tokens_expiresAt_idx" ON account_tokens("expiresAt");
