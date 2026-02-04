/*
  Warnings:

  - A unique constraint covering the columns `[ownerId,uuid]` on the table `Game` will be added. If there are existing duplicate values, this will fail.
  - Made the column `gameId` on table `Char` required. This step will fail if there are existing NULL values in that column.
  - Made the column `charId` on table `Save` required. This step will fail if there are existing NULL values in that column.
  - Made the column `gameId` on table `Save` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `hash` to the `SessionToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `public` to the `SessionToken` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Game_uuid_key";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Char" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slots" TEXT NOT NULL DEFAULT '[]',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ownerId" INTEGER NOT NULL,
    "gameId" TEXT NOT NULL,
    CONSTRAINT "Char_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Char_gameId_ownerId_fkey" FOREIGN KEY ("gameId", "ownerId") REFERENCES "Game" ("uuid", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Char" ("archived", "archivedAt", "createdAt", "gameId", "id", "name", "ownerId", "slots", "updatedAt", "uuid") SELECT "archived", "archivedAt", "createdAt", "gameId", "id", "name", "ownerId", "slots", "updatedAt", "uuid" FROM "Char";
DROP TABLE "Char";
ALTER TABLE "new_Char" RENAME TO "Char";
CREATE UNIQUE INDEX "Char_ownerId_uuid_key" ON "Char"("ownerId", "uuid");
CREATE TABLE "new_Save" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "uuid" TEXT NOT NULL,
    "name" TEXT,
    "gameVersion" TEXT,
    "description" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "ownerId" INTEGER NOT NULL,
    "gameId" TEXT NOT NULL,
    "charId" TEXT NOT NULL,
    CONSTRAINT "Save_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Save_gameId_ownerId_fkey" FOREIGN KEY ("gameId", "ownerId") REFERENCES "Game" ("uuid", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Save_charId_ownerId_fkey" FOREIGN KEY ("charId", "ownerId") REFERENCES "Char" ("uuid", "ownerId") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Save" ("archived", "archivedAt", "charId", "createdAt", "data", "description", "gameId", "gameVersion", "hash", "id", "name", "ownerId", "size", "updatedAt", "uuid") SELECT "archived", "archivedAt", "charId", "createdAt", "data", "description", "gameId", "gameVersion", "hash", "id", "name", "ownerId", "size", "updatedAt", "uuid" FROM "Save";
DROP TABLE "Save";
ALTER TABLE "new_Save" RENAME TO "Save";
CREATE UNIQUE INDEX "Save_ownerId_uuid_key" ON "Save"("ownerId", "uuid");
CREATE TABLE "new_SessionToken" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "public" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "sessionId" INTEGER NOT NULL,
    CONSTRAINT "SessionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SessionToken_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SessionToken" ("active", "createdAt", "expiresAt", "id", "sessionId", "userId") SELECT "active", "createdAt", "expiresAt", "id", "sessionId", "userId" FROM "SessionToken";
DROP TABLE "SessionToken";
ALTER TABLE "new_SessionToken" RENAME TO "SessionToken";
CREATE UNIQUE INDEX "SessionToken_public_key" ON "SessionToken"("public");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Game_ownerId_uuid_key" ON "Game"("ownerId", "uuid");
