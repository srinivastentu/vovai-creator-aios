import type { ArtifactType } from "@/generated/prisma/client"

// Human-readable labels for the V1 artifact types — single source of truth
// (consumed by the workbench shell + dashboard + review previews). A typed
// Record<ArtifactType, …> so adding a V2 artifact type is a compile error here
// until its label is supplied.
export const ARTIFACT_TYPE_LABEL: Record<ArtifactType, string> = {
  linkedin_post: "LinkedIn post",
  long_form_article: "Long-form article",
}
