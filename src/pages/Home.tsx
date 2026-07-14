import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Zap, ShieldCheck, ArrowRight, Search, MessageSquare, Building2, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/I18nProvider";
import logoAsset from "@/assets/hokim-logo.png.asset.json";

export default function Home() {
  const { t } = useI18n();

  const features = [
    { icon: Sparkles, title: t("features.ai_title"), desc: t("features.ai_desc") },
    { icon: Zap, title: t("features.fast_title"), desc: t("features.fast_desc") },
    { icon: ShieldCheck, title: t("features.secure_title"), desc: t("features.secure_desc") },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl gradient-hero text-primary-foreground p-8 md:p-14 shadow-elegant">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 20%, white 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }} />
        <div className="absolute -right-10 -top-10 opacity-20 hidden md:block">
          <img src={logoAsset.url} alt="" className="h-72 w-72 object-contain" width={288} height={288} />
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur px-3 py-1 text-xs font-medium mb-5 border border-white/20">
            <Building2 className="h-3.5 w-3.5" /> {t("hero.badge")}
          </span>
          <h1 className="text-3xl md:text-5xl lg:text-6xl font-extrabold leading-[1.05] mb-5">{t("hero.title")}</h1>
          <p className="text-base md:text-lg text-primary-foreground/80 mb-8 max-w-2xl">{t("hero.subtitle")}</p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 shadow-elegant">
              <Link to="/submit">{t("hero.cta_submit")} <ArrowRight className="ml-1 h-4 w-4" /></Link>
            </Button>
            <Button asChild size="lg" className="bg-white text-primary hover:bg-white/90">
              <Link to="/chat"><MessageSquare className="mr-1 h-4 w-4" /> {t("hero.cta_chat")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-white/5 border-white/30 text-primary-foreground hover:bg-white/15 hover:text-primary-foreground">
              <Link to="/track"><Search className="mr-1 h-4 w-4" /> {t("hero.cta_track")}</Link>
            </Button>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-5 mt-8">
        {features.map((f, i) => (
          <motion.div key={f.title} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 * i }}
            className="glass rounded-2xl p-6 transition-smooth hover:-translate-y-0.5 hover:shadow-elegant">
            <div className="h-11 w-11 rounded-xl gradient-accent flex items-center justify-center mb-4 shadow-card-soft">
              <f.icon className="h-5 w-5 text-accent-foreground" />
            </div>
            <h3 className="font-bold text-lg mb-1.5">{f.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* Contact strip */}
      <section className="grid md:grid-cols-3 gap-4 mt-8">
        <div className="glass rounded-xl p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg gradient-accent flex items-center justify-center"><Phone className="h-5 w-5 text-accent-foreground" /></div>
          <div><div className="text-xs text-muted-foreground">Ishonch telefoni</div><div className="font-bold">1212</div></div>
        </div>
        <div className="glass rounded-xl p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg gradient-accent flex items-center justify-center"><Mail className="h-5 w-5 text-accent-foreground" /></div>
          <div><div className="text-xs text-muted-foreground">Elektron pochta</div><div className="font-bold">info@fergana.uz</div></div>
        </div>
        <div className="glass rounded-xl p-5 flex items-center gap-4">
          <div className="h-10 w-10 rounded-lg gradient-accent flex items-center justify-center"><Building2 className="h-5 w-5 text-accent-foreground" /></div>
          <div><div className="text-xs text-muted-foreground">Manzil</div><div className="font-bold">Farg'ona tumani hokimligi</div></div>
        </div>
      </section>
    </div>
  );
}
