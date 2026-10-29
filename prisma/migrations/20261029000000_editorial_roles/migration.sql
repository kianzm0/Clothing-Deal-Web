-- Every existing account remains a customer. Grants are explicit operator actions.
CREATE TYPE "UserRole" AS ENUM ('USER', 'EDITOR', 'ADMIN');
ALTER TABLE "users" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'USER';
