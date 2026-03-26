import BoostScanner from "@/components/BoostScanner";
import { Flame } from "lucide-react"; // Custom flame icon for the boost

export default function ScannerPage() {
  return (
    // Standard background and text colors for optimal readability
    <div className="flex flex-col items-center min-h-screen p-4 md:p-8 bg-background text-foreground">
      <div className="w-full max-w-4xl space-y-8 mt-4 md:mt-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
            <Flame className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          Drop a Pic → AI Glow-Up → Matches Explode
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          End the dry spell.
          One photo is all it takes for AI to turn you into a right-swipe magnet.
          </p>
        </div>
        
        {/* Core Scanner: Wrapped with a primary-tinted shadow for a premium floating effect */}
        <div className="shadow-2xl shadow-primary/20 rounded-2xl overflow-hidden border border-border bg-card">
          <BoostScanner />
        </div>
        
      </div>
    </div>
  );
}
