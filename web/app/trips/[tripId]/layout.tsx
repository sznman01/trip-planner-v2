import BottomTabBar from "@/components/BottomTabBar";


export default function TripLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pb-24">
      {children}
      <BottomTabBar />
    </div>
  );
}
