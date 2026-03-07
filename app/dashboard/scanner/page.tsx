import RoastScanner from "@/components/RoastScanner";
import { Flame } from "lucide-react"; // 引入我们专属的火焰图标

export default function ScannerPage() {
  return (
    // 换回 bg-background (默认白底) 和 text-foreground (默认深色字)
    <div className="flex flex-col items-center min-h-screen p-4 md:p-8 bg-background text-foreground">
      <div className="w-full max-w-4xl space-y-8 mt-4 md:mt-12">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-2">
            <Flame className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          Upload Photo → AI Deep Scan → Brutally Honest Roast
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            别害怕。上传你的 Tinder / Hinge 截图或对镜自拍，让 AI 用最恶毒（但真实）的眼光，帮你扫清那些让你匹配率暴跌的致命雷区。
          </p>
        </div>
        
        {/* 核心组件区：在白底上加了一层更明显的红色弥散阴影，让中间的扫描器像艺术品一样浮起来 */}
        <div className="shadow-2xl shadow-primary/20 rounded-2xl overflow-hidden border border-border bg-card">
          <RoastScanner />
        </div>
        
      </div>
    </div>
  );
}