/*
  Warnings:

  - You are about to drop the `ble_tokens` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "ble_tokens" DROP CONSTRAINT "ble_tokens_user_id_fkey";

-- DropTable
DROP TABLE "ble_tokens";
