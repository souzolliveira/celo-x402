import { SearchDetailView } from "@/components/search-history";
import { PageHeader } from "@/components/ui";

export default async function SearchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <PageHeader
        title="Search"
        description="The edition is set in the style of each network. Raw calls stay in the other view."
        backHref="/searches"
      />
      <SearchDetailView id={id} />
    </>
  );
}
