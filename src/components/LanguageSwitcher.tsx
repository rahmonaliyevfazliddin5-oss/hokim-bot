import { useI18n, Lang } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

const opts: { code: Lang; label: string }[] = [
  { code: "uz", label: "UZ" },
  { code: "uz_cyrl", label: "ЎЗ" },
  { code: "ru", label: "RU" },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useI18n();
  return (
    <div className="inline-flex items-center rounded-full bg-secondary p-1 text-xs font-semibold">
      {opts.map(o => (
        <button
          key={o.code}
          onClick={() => setLang(o.code)}
          className={cn(
            "px-3 py-1.5 rounded-full transition-smooth",
            lang === o.code ? "bg-primary text-primary-foreground shadow-card-soft" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
