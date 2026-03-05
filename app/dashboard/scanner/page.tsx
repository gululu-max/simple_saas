import RoastScanner from "@/components/RoastScanner";

export default function ScannerPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background">
      <div className="w-full max-w-4xl space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Profile Red Flag Scanner 🚩</h1>
          <p className="text-muted-foreground">
            上传你的 Dating Profile 截图，我们的 AI 会用最恶毒（但真实）的眼光，帮你找出那些让你匹配率暴跌的致命雷区。
          </p>
        </div>
        
        {/* 这里就是你刚才换好皮肤的核心组件 */}
        <RoastScanner />
        
      </div>
    </div>
  );
}
