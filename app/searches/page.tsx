import { SearchList } from "@/components/search-history";
import { PageHeader } from "@/components/ui";

export default function SearchesPage() {
  return (
    <>
      <PageHeader
        title="Searches"
        description="Each row is one digest. Pending ones are still running. Refresh to see calls that finished after you opened the page."
        backHref="/"
      />
      <SearchList />
    </>
  );
}
