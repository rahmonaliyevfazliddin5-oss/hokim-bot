import { Link } from "react-router-dom";
import { Flame, Zap, Droplet, TrafficCone, Phone, ArrowRight, MapPin } from "lucide-react";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const departments = [
  {
    icon: Flame,
    name: "Gaz ta'minoti",
    org: "Farg'ona tuman gaz xizmati",
    hotline: "1104",
    issues: [
      "Gaz bosimi pastligi yoki umuman kelmasligi",
      "Gaz hidi va sizib chiqish holatlari (favqulodda)",
      "Hisoblagichni almashtirish va tekshirish",
      "Yangi abonent ulash",
    ],
  },
  {
    icon: Zap,
    name: "Elektr ta'minoti",
    org: "Farg'ona tuman elektr tarmoqlari",
    hotline: "1156",
    issues: [
      "Uzoq muddatli elektr uzilishi",
      "Voltaj o'zgarishlari va simlar shikastlanishi",
      "Yoritish ustunlari va ko'chadagi chiroqlar",
      "Elektr hisoblagichi bilan bog'liq masalalar",
    ],
  },
  {
    icon: Droplet,
    name: "Suv va kanalizatsiya",
    org: "Farg'ona tuman \"Suvoqava\" xizmati",
    hotline: "1176",
    issues: [
      "Ichimlik suvi kelmasligi yoki loyqaligi",
      "Kanalizatsiya toshishi",
      "Suv quvurlari va lyuklar shikastlanishi",
      "Yangi ulanish va tarif masalalari",
    ],
  },
  {
    icon: TrafficCone,
    name: "Yo'l va infratuzilma",
    org: "Farg'ona tuman avtomobil yo'llari bo'limi",
    hotline: "1212",
    issues: [
      "Yo'llardagi chuqurlar va o'pirilishlar",
      "Svetofor va yo'l belgilari nosozligi",
      "Ko'cha tozalash va qorni tozalash",
      "Mahalla ichi yo'llarini ta'mirlash",
    ],
  },
];

export default function ServicesGuide() {
  return (
    <>
      <SEO
        title="Farg'ona tumani xizmatlar qo'llanmasi — Hokim AI"
        description="Farg'ona tumani hokimligining rasmiy xizmatlar qo'llanmasi: gaz, elektr, suv va yo'l bo'limlariga qanday murojaat qilish, ishonch telefonlari va onlayn ariza yuborish."
        path="/services-guide"
      />
      <div className="mx-auto max-w-5xl px-4 py-10 space-y-10">
        <header className="space-y-3">
          <p className="text-sm font-medium text-primary">Farg'ona tumani hokimligi</p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Farg'ona tumani xizmatlar qo'llanmasi
          </h1>
          <p className="text-muted-foreground max-w-3xl">
            Ushbu qo'llanma Farg'ona tumani fuqarolari uchun kommunal va infratuzilma bo'limlariga
            qanday murojaat qilishni tushuntiradi. Hokim AI — bu tuman uchun ishlab chiqilgan
            jamoaviy hamkorlik platformasi (community engagement platform) bo'lib, murojaatlarni
            sun'iy intellekt yordamida tegishli mahalla yoki bo'limga avtomatik yo'naltiradi.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild>
              <Link to="/submit">
                Onlayn murojaat yuborish <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/track">Murojaat holatini tekshirish</Link>
            </Button>
          </div>
        </header>

        <section aria-labelledby="departments-heading" className="space-y-4">
          <h2 id="departments-heading" className="text-2xl font-semibold">
            Bo'limlar bo'yicha yo'riqnoma
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {departments.map((d) => {
              const Icon = d.icon;
              return (
                <Card key={d.name}>
                  <CardHeader>
                    <div className="flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-2 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{d.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{d.org}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <a
                      href={`tel:${d.hotline}`}
                      className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                    >
                      <Phone className="h-4 w-4" /> Ishonch telefoni: {d.hotline}
                    </a>
                    <ul className="list-disc pl-5 text-sm space-y-1 text-muted-foreground">
                      {d.issues.map((i) => (
                        <li key={i}>{i}</li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="how-heading" className="space-y-4">
          <h2 id="how-heading" className="text-2xl font-semibold">
            Muammoni qanday hal qilish kerak
          </h2>
          <ol className="list-decimal pl-6 space-y-2 text-muted-foreground">
            <li>
              <span className="text-foreground font-medium">Bo'limni aniqlang.</span> Yuqoridagi
              ro'yxatdan muammoingizga eng mos keluvchi bo'limni tanlang.
            </li>
            <li>
              <span className="text-foreground font-medium">Ishonch telefoniga qo'ng'iroq qiling</span>{" "}
              — favqulodda holatlar (gaz sizishi, suv toshqini, elektr xavfi) uchun bu eng tez usul.
            </li>
            <li>
              <span className="text-foreground font-medium">Onlayn murojaat yuboring.</span>{" "}
              <Link to="/submit" className="text-primary underline">
                /submit
              </Link>{" "}
              sahifasida MFY, manzil va rasmlarni yuklang — AI muammoni tahlil qilib, tegishli
              mahalla yoki bo'limga yo'naltiradi.
            </li>
            <li>
              <span className="text-foreground font-medium">HOK-kod orqali kuzating.</span>{" "}
              Murojaatingizga berilgan <code>HOK-YYYYMMDD-NNNN</code> kodi bilan{" "}
              <Link to="/track" className="text-primary underline">
                /track
              </Link>{" "}
              sahifasida holatini kuzatib boring.
            </li>
          </ol>
        </section>

        <section aria-labelledby="mahalla-heading" className="space-y-3">
          <h2 id="mahalla-heading" className="text-2xl font-semibold">
            Mahalla darajasidagi masalalar
          </h2>
          <p className="text-muted-foreground">
            Ko'plab kundalik masalalar — obodonlashtirish, mahalliy nizolar, kichik ta'mirlash
            ishlari — avval MFY (mahalla fuqarolar yig'ini) darajasida hal qilinadi. Farg'ona
            tumanida 71 ta MFY faoliyat yuritadi va Hokim AI orqali yuborilgan murojaatlar
            avtomatik ravishda kerakli MFY raisiga yetkaziladi.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            Manzil: Vodil MFY, Marg'ilon ko'chasi, 1-uy
          </div>
        </section>

        <section aria-labelledby="faq-heading" className="space-y-4">
          <h2 id="faq-heading" className="text-2xl font-semibold">
            Ko'p beriladigan savollar
          </h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">Murojaat necha kunda ko'rib chiqiladi?</h3>
              <p className="text-sm text-muted-foreground">
                AI muammoning og'irlik darajasiga qarab taxminiy muddatni belgilaydi: oddiy holatlar
                3–7 kun, o'rta darajali holatlar 7–30 kun, murakkab loyihalar 30+ kun.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Bir nechta muammoni bitta murojaatda yuborsam bo'ladimi?</h3>
              <p className="text-sm text-muted-foreground">
                Ha. AI matnni tahlil qilib, bir necha kategoriyani (masalan, gaz va elektr) bir
                vaqtda aniqlaydi va har biriga tegishli bo'limga yo'naltiradi.
              </p>
            </div>
            <div>
              <h3 className="font-medium">Ismimni maxfiy saqlash mumkinmi?</h3>
              <p className="text-sm text-muted-foreground">
                Ha, murojaat yuborishda anonim rejimni tanlashingiz mumkin. Telefon raqami faqat
                mas'ul xodimlarga ko'rinadi.
              </p>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
