import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

const styles: Record<string, string> = {
  yangi: "bg-accent/15 text-accent border-accent/30",
  jarayonda: "bg-warning/15 text-warning-foreground border-warning/40",
  bajarildi: "bg-success/15 text-success border-success/30",
  rad_etildi: "bg-destructive/10 text-destructive border-destructive/30",
};

export function StatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const key = status.replace(" ", "_");
  return (
    <span className={cn(
      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
      styles[key] || "bg-muted text-muted-foreground border-border"
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(`status.${key}`)}
    </span>
  );
}
