export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { sweepCredits } = await import("@/lib/credit-sweep");
  const { pumpResearches } = await import("@/lib/digest-run");
  const minute = 60_000;
  setInterval(() => {
    void sweepCredits();
    void pumpResearches();
  }, minute);
  void sweepCredits();
  void pumpResearches();
}
