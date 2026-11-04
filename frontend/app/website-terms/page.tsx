import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { LegalDocument } from "@/components/legal-document";

export default async function WebsiteTermsPage() {
  const content = await readFile(
    join(process.cwd(), "app", "website-terms", "terms-of-use.md"),
    "utf8",
  );

  return <LegalDocument title="Website terms" content={content} />;
}
