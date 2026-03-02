-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MenuItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "description" TEXT,
    "available" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_MenuItem" ("id", "name", "priceCents", "sku") SELECT "id", "name", "priceCents", "sku" FROM "MenuItem";
DROP TABLE "MenuItem";
ALTER TABLE "new_MenuItem" RENAME TO "MenuItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
