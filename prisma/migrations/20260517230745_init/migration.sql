-- CreateTable
CREATE TABLE "Chest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chestName" TEXT NOT NULL,
    "fromPlayer" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "time" DATETIME NOT NULL,
    "gameDay" TEXT NOT NULL,
    "originalTimer" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PlayerFix" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ocrName" TEXT NOT NULL,
    "correctedTo" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UnknownPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ocrName" TEXT NOT NULL,
    "encountered" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerFix_ocrName_key" ON "PlayerFix"("ocrName");

-- CreateIndex
CREATE UNIQUE INDEX "UnknownPlayer_ocrName_key" ON "UnknownPlayer"("ocrName");
