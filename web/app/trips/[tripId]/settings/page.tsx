"use client";

import { useParams } from "next/navigation";
import { useThemeStore } from "@/lib/store/theme";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SettingsPage() {
  const params = useParams<{ tripId: string }>();
  const tripId = params.tripId as string;

  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const themes = [
    { id: "sakura" as const, label: "櫻花（淺色）", desc: "日本太陽紅 + 櫻花粉" },
    { id: "matcha" as const, label: "抹茶（淺色）", desc: "玄武岩黑 + 抹茶綠" },
    { id: "dark" as const, label: "深色", desc: "深藍灰 + 粉紅主色" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-muted-foreground">主題顏色</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>選擇主題</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-0">
          {themes.map((t) => (
            <Button
              key={t.id}
              variant={theme === t.id ? "default" : "outline"}
              className="h-auto p-6 flex flex-col items-center gap-2"
              onClick={() => setTheme(t.id)}
            >
              <div className="w-16 h-16 rounded-xl bg-gradient-to-br shadow-lg" />
              <div className="text-sm font-semibold">{t.label}</div>
              <div className="text-xs text-muted-foreground">{t.desc}</div>
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 pt-0">
          <p className="text-sm text-muted-foreground">
            目前主題：{themes.find((t) => t.id === theme)?.label}
          </p>
        </Card>
      </Card>
    </div>
  );
}
