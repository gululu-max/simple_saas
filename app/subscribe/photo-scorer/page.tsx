import { redirect } from "next/navigation";

export default function PhotoScorerPage() {
  redirect("/subscribe/photo-enhancer");
}




// import PhotoScorer from "@/components/PhotoScorer";
// import { Target } from "lucide-react";

// export default function PhotoScorerPage() {
//   return (
//     <div className="flex flex-col items-center min-h-screen p-4 md:p-8 bg-background text-foreground selection:bg-primary/20">
//       <div className="w-full max-w-4xl space-y-8 mt-4 md:mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        
//         {/* Hero Section */}
//         <div className="text-center space-y-4">
//           <div className="inline-flex items-center justify-center p-4 bg-primary/10 rounded-full mb-2 border border-primary/20 shadow-sm">
//             <Target className="w-8 h-8 text-primary" />
//           </div>
//           <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
//             AI Photo Scorer
//           </h1>
//           <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
//             Upload 3-9 of your dating photos, AI will score each photo, rank them, provide detailed explanations, and design the absolute best Profile display order for you.
//           </p>
//         </div>
        
//         {/* Core Photo Scorer Component */}
//         {/* 注意：为了避免双重标题，建议你去 PhotoScorer 组件里把内部的 Header Section 删掉 */}
//         <div className="shadow-2xl shadow-primary/10 rounded-2xl overflow-hidden border border-border bg-card">
//           <PhotoScorer />
//         </div>
        
//       </div>
//     </div>
//   );
// }