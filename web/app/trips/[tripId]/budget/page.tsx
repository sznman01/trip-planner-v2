import ClientBudgetPage from "./ClientBudgetPage";

// ✅ 必須要有呢個 function 先可以做 static export
export async function generateStaticParams() {
  return [
    { tripId: "acb6f4ba-3009-4a20-9bea-89ed28365972" }, // 你主要用緊嗰個 tripId
    { tripId: "demo-tokyo-2026" },
  ];
}

// ✅ 呢個 Server Page 只係負責 render 個 Client Page
export default function BudgetPage() {
  return <ClientBudgetPage />;
}
