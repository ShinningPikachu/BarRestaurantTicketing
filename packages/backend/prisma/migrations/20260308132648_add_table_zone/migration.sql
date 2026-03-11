-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Table" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" INTEGER NOT NULL,
    "zone" TEXT,
    "seats" INTEGER DEFAULT 4,
    "name" TEXT
);
INSERT INTO "new_Table" ("id", "name", "number", "seats") SELECT "id", "name", "number", "seats" FROM "Table";
DROP TABLE "Table";
ALTER TABLE "new_Table" RENAME TO "Table";
CREATE UNIQUE INDEX "Table_number_zone_key" ON "Table"("number", "zone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
