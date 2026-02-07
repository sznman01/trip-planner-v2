import BottomTabBar from "@/components/BottomTabBar";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  // GitHub Pages 靜態 export：build 時無法知道 localStorage 裡面有咩 tripId
  // 所以先回傳空陣列，令 export 可以完成
  return [];
}

export default function TripLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-24">
      {children}
      <BottomTabBar />
    </div>
  );
}
