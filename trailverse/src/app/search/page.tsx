import type { Metadata } from "next"
import Navbar from "@/components/Navbar"
import TrekExplorer from "@/components/TrekExplorer"
import Footer from "@/components/Footer"

export const metadata: Metadata = {
  title: "All-India Global Trek Search | TrailVerse",
  description:
    "Search any trek, mountain peak, or pass across the Himalayas, Western Ghats, and all of India with real-time hazard evaluation and live mountain weather.",
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>
}) {
  const resolvedParams = searchParams ? await searchParams : {}
  const initialQuery = resolvedParams.q || ""

  return (
    <main className="bg-black min-h-screen">
      <Navbar />
      <TrekExplorer initialScope="global" initialQuery={initialQuery} />
      <Footer />
    </main>
  )
}
