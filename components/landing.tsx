const quotes = [
  {
    quote: "I opened the row at 8 and already knew which competitor post the team should answer.",
    name: "Maya Chen",
    role: "Content lead",
  },
  {
    quote: "I stopped opening five apps to see what the category did while we were offline.",
    name: "Diego Alvarez",
    role: "Brand manager",
  },
  {
    quote: "The replies were next to the posts, so the standup brief was already written.",
    name: "Priya Nair",
    role: "Social manager",
  },
];

const steps = [
  {
    title: "The morning is scattered",
    body: "Competitors, creators, and the brand conversation live on five networks. Someone opens each one before standup, and still misses the comment that mattered.",
  },
  {
    title: "The watch list is the brief",
    body: "The accounts the team already cares about become the reading. New posts and the replies around them land together, instead of a pile of tabs.",
  },
  {
    title: "Standup starts informed",
    body: "The team walks in knowing what changed overnight: who posted, what people said, and which thread is worth answering first.",
  },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <a href="#content" className="font-display text-3xl text-foreground">
          Brief
        </a>
        <a
          href="/login"
          className="inline-flex min-h-12 items-center rounded-2xl bg-accent px-5 text-base font-semibold text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Open your brief
        </a>
      </header>
      <main id="content">
        <section className="mx-auto grid w-full max-w-5xl items-end gap-10 px-4 pb-16 pt-8 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)] lg:pt-16">
          <div>
            <h1 className="max-w-[16ch] text-5xl text-foreground sm:text-6xl">Read what they posted before standup</h1>
            <p className="mt-5 max-w-[42ch] text-lg text-muted-foreground">
              A morning reading for the accounts your marketing team already watches, so standup starts with what changed overnight.
            </p>
            <a
              href="/login"
              className="mt-8 inline-flex min-h-12 items-center rounded-2xl bg-accent px-5 text-base font-semibold text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Open your brief
            </a>
          </div>
          <aside className="rounded-2xl border border-border bg-card p-5 shadow-[0_12px_32px_-18px_rgba(26,28,18,0.45)]">
            <p className="text-sm font-semibold text-foreground">Before the 9am standup</p>
            <p className="mt-4 font-display text-4xl text-foreground">What changed</p>
            <ul className="mt-4 grid gap-2 text-sm text-foreground">
              <li>A competitor posted overnight</li>
              <li>People replied under the thread</li>
              <li>The team knows which one to answer</li>
            </ul>
          </aside>
        </section>

        <section className="border-y border-border bg-card">
          <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
            {steps.map((step) => (
              <div key={step.title}>
                <h2 className="text-3xl text-foreground">{step.title}</h2>
                <p className="mt-3 max-w-[36ch] text-muted-foreground">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-4xl text-foreground">Who it is for</h2>
            <p className="mt-4 max-w-prose text-muted-foreground">
              Content, brand, and social teams that need the overnight picture before they plan the day. The reading follows the people and the topics the desk already tracks.
            </p>
          </div>
          <div>
            <h2 className="text-4xl text-foreground">What it replaces</h2>
            <p className="mt-4 max-w-prose text-muted-foreground">
              The first hour spent hopping between networks, pasting links into a doc, and still arriving unsure which post deserves a reply. Brief is that hour, already done.
            </p>
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6">
            <h2 className="max-w-[18ch] text-4xl text-foreground">What a marketing desk would say</h2>
            <p className="mt-4 max-w-prose text-muted-foreground">
              Sample lines for the job Brief is built for. Swap them when a team has used a real morning row.
            </p>
            <ul className="mt-10 grid gap-8 md:grid-cols-3">
              {quotes.map((item) => (
                <li key={item.role}>
                  <blockquote className="text-lg text-foreground">“{item.quote}”</blockquote>
                  <p className="mt-4 text-sm font-semibold text-muted-foreground">
                    {item.name}, {item.role}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-border bg-muted">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-4 py-16 sm:px-6">
            <h2 className="max-w-[16ch] text-4xl text-foreground">Open the brief with your email</h2>
            <p className="max-w-prose text-muted-foreground">
              Sign in with your email. The same address brings you back to the reading your team set up.
            </p>
            <a
              href="/login"
              className="inline-flex min-h-12 items-center rounded-2xl bg-accent px-5 text-base font-semibold text-on-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              Open your brief
            </a>
          </div>
        </section>
      </main>
      <footer className="border-t border-border">
        <div className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_auto]">
          <div>
            <p className="font-display text-3xl text-foreground">Brief</p>
            <p className="mt-3 max-w-prose text-sm text-muted-foreground">
              Overnight reading for marketing teams. The accounts you watch, ready before standup.
            </p>
          </div>
          <nav aria-label="Footer" className="grid content-start gap-2 text-sm font-semibold">
            <a href="#content" className="text-foreground underline">
              Top
            </a>
            <a href="/login" className="text-foreground underline">
              Open your brief
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
