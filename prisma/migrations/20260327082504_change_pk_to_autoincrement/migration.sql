/*
  Warnings:

  - The primary key for the `friendships` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `friendships` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `guestbook_entries` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `guestbook_entries` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `guestbook_requests` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `guestbook_requests` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "friendships" DROP CONSTRAINT "friendships_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "guestbook_entries" DROP CONSTRAINT "guestbook_entries_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "guestbook_entries_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "guestbook_requests" DROP CONSTRAINT "guestbook_requests_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "guestbook_requests_pkey" PRIMARY KEY ("id");
