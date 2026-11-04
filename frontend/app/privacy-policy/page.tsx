import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { LegalDocument } from "@/components/legal-document";

export default async function PrivacyPolicyPage() {
  const content = await readFile(
    join(process.cwd(), "app", "privacy-policy", "privacy-policy.md"),
    "utf8",
  );

  return <LegalDocument title="Privacy policy" content={content} />;
}
