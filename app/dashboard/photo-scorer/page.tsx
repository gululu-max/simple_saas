import PhotoScorer from "@/components/PhotoScorer";
import { Target } from "lucide-react";

export default function PhotoScorerPage() {
  return (
    <div className="flex flex-col items-center min-h-screen p-4 md:p-8 bg-background text-foreground">
      <div className="w-full max-w-4xl space-y-8 mt-4 md:mt-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
            <Target className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
            AI Photo Scorer
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Upload 3-9 of your dating photos, AI will do for you: score each photo, rank, detailed explanation, and design the best Profile display order. Let AI help you find the most attractive photo combination.
          </p>
        </div>
        
        {/* Core Photo Scorer */}
        <div className="shadow-2xl shadow-primary/20 rounded-2xl overflow-hidden border border-border bg-card">
          <PhotoScorer />
        </div>
        
      </div>
    </div>
  );
}