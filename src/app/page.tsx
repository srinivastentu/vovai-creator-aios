import { LandingPrompt } from "@/components/landing/LandingPrompt"
import { RecentProjectsList } from "@/components/landing/RecentProjectsList"

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-2xl text-center mb-8">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          VOVAI eLearn AIOS
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your Agentic eLearning OS
        </p>
      </div>

      <LandingPrompt />
      <RecentProjectsList />
    </main>
  )
}
