import Link from "next/link";

type Props = { params: Promise<{ token: string }> };

export default async function ConsentPage({ params }: Props) {
  const { token } = await params;
  return (
    <main className="mx-auto max-w-2xl px-8 py-16">
      <h1 className="page-title">Before you start</h1>
      {/* Placeholder stays visible until the ethics-reviewed consent text replaces it. */}
      <p className="mt-4">[Consent text goes here after ethics review]</p>
      <Link href={`/s/${token}/billing`} className="btn-primary mt-8">
        Start task
      </Link>
    </main>
  );
}
