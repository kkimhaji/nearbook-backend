-- CreateEnum
CREATE TYPE "GuestbookVisibility" AS ENUM ('private', 'friends_only');

-- AlterTable
ALTER TABLE "guestbook_entries" ADD COLUMN     "visibility" "GuestbookVisibility" NOT NULL DEFAULT 'private';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "guestbook_visibility" "GuestbookVisibility" NOT NULL DEFAULT 'private';
