-- AlterEnum: Replace old ProjectArchetype values with new ones
BEGIN;
CREATE TYPE "ProjectArchetype_new" AS ENUM ('k12_curriculum', 'professional_training', 'content_channel');
ALTER TABLE "ProjectBlueprint" ALTER COLUMN "archetype" DROP DEFAULT;
ALTER TABLE "ProjectBlueprint" ALTER COLUMN "archetype" TYPE "ProjectArchetype_new" USING ("archetype"::text::"ProjectArchetype_new");
ALTER TYPE "ProjectArchetype" RENAME TO "ProjectArchetype_old";
ALTER TYPE "ProjectArchetype_new" RENAME TO "ProjectArchetype";
DROP TYPE "ProjectArchetype_old";
ALTER TABLE "ProjectBlueprint" ALTER COLUMN "archetype" SET DEFAULT 'professional_training';
COMMIT;
