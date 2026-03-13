import { Globe } from "lucide-react";
import { useLocale } from "../hooks/useLocale";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "../lib/utils";
import type { SupportedLocale } from "../i18n";

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  "zh-CN": "中文（简体）",
  ja: "日本語",
};

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, supportedLocales } = useLocale();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" className={cn("text-muted-foreground shrink-0", className)} aria-label="Switch language">
          <Globe className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-1" align="start">
        {supportedLocales.map((code) => (
          <button
            key={code}
            type="button"
            className={cn(
              "w-full rounded px-2 py-1.5 text-left text-xs hover:bg-accent",
              locale === code && "bg-accent font-medium"
            )}
            onClick={() => setLocale(code)}
          >
            {LOCALE_LABELS[code]}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
