import { CatalogBrowser } from "@/components/catalog-browser";
import { PageHeader } from "@/components/ui";

export default function CatalogPage() {
  return (
    <>
      <PageHeader
        title="Sources"
        description="Choose the data each digest reads overnight. The known total reserves the posts you set from the previous day in Brasília."
        backHref="/"
      />
      <CatalogBrowser />
    </>
  );
}
