import Navbar from "@/components/Navbar"
import TrekExplorer from "@/components/TrekExplorer"
import Footer from "@/components/Footer"

export default function Explore() {
  return (
    <main className="bg-black min-h-screen">
      <Navbar />
      <TrekExplorer />
      <Footer />
    </main>
  )
}