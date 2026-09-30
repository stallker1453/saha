import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  joinMatch,
  leaveMatch,
  pickTeam as pickTeamFn,
  resetWeek as resetWeekFn,
  adminLogin,
  adminRemove,
} from "@/lib/players.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Halısaha Maç Listesi | Haftalık Kadro" },
      {
        name: "description",
        content:
          "Şifresiz halısaha kayıt sayfası: ismini yaz, as kadroya veya yedek listesine gir, siyah ya da beyaz takımını seç.",
      },
      { property: "og:title", content: "Halısaha Maç Listesi | Haftalık Kadro" },
      {
        property: "og:description",
        content:
          "Şifresiz halısaha kayıt sayfası: ismini yaz, as kadroya veya yedek listesine gir, siyah ya da beyaz takımını seç.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Player = {
  id: string;
  name: string;
  team: "black" | "white" | null;
  created_at: string;
};

const SQUAD_SIZE = 14;
const TEAM_SIZE = 7;

function saat(iso: string) {
  return new Date(iso).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function gun(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
  });
}

const TOKENS_KEY = "halisaha-tokens";
function readTokens(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(TOKENS_KEY) || "{}");
  } catch {
    return {};
  }
}
function errMsg(e: unknown, fallback: string) {
  return e instanceof Error && e.message ? e.message : fallback;
}

function Index() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [tokens, setTokens] = useState<Record<string, string>>({});
  const joinFn = useServerFn(joinMatch);
  const teamFn = useServerFn(pickTeamFn);
  const leaveFn = useServerFn(leaveMatch);
  const resetFn = useServerFn(resetWeekFn);
  const adminLoginFn = useServerFn(adminLogin);
  const adminRemoveFn = useServerFn(adminRemove);
  const [adminMode, setAdminMode] = useState(false);

  useEffect(() => {
    setTokens(readTokens());
  }, []);

  const saveTokens = (next: Record<string, string>) => {
    setTokens(next);
    localStorage.setItem(TOKENS_KEY, JSON.stringify(next));
  };

  const load = async () => {
    const { data, error } = await supabase
      .from("players")
      .select("id,name,team,created_at")
      .order("created_at", { ascending: true });
    if (error) {
      toast.error("Liste yüklenemedi, tekrar deneyin.");
      return;
    }
    setPlayers((data ?? []) as Player[]);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
    const channel = supabase
      .channel("players-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "players" }, () => {
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const squad = useMemo(() => players.slice(0, SQUAD_SIZE), [players]);
  const subs = useMemo(() => players.slice(SQUAD_SIZE), [players]);
  const blackCount = squad.filter((p) => p.team === "black").length;
  const whiteCount = squad.filter((p) => p.team === "white").length;
  const isMine = (p: Player) => Boolean(tokens[p.id]);

  const join = async () => {
    const temiz = name.trim();
    if (temiz.length < 2) {
      toast.error("Lütfen isminizi yazın.");
      return;
    }
    setBusy(true);
    try {
      const r = await joinFn({ data: { name: temiz } });
      saveTokens({ ...readTokens(), [r.id]: r.token });
      setName("");
      toast.success(`${temiz} listeye eklendi.`);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Kayıt yapılamadı, tekrar deneyin."));
    } finally {
      setBusy(false);
    }
  };

  const leave = async (p: Player) => {
    const token = tokens[p.id];
    if (!token) return;
    setBusy(true);
    try {
      await leaveFn({ data: { id: p.id, token } });
      const next = { ...readTokens() };
      delete next[p.id];
      saveTokens(next);
      toast(`${p.name} maçtan çıktı.`);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Silinemedi."));
    } finally {
      setBusy(false);
    }
  };

  const adminEnter = async () => {
    setBusy(true);
    try {
      await adminLoginFn({ data: { password } });
      setAdminMode(true);
      toast.success("Yönetici modu açıldı.");
    } catch (e) {
      toast.error(errMsg(e, "Yönetici şifresi yanlış."));
    } finally {
      setBusy(false);
    }
  };

  const adminKick = async (p: Player) => {
    if (!confirm(`${p.name} maçtan çıkarılsın mı?`)) return;
    setBusy(true);
    try {
      await adminRemoveFn({ data: { password, id: p.id } });
      toast(`${p.name} maçtan çıkarıldı.`);
      load();
    } catch (e) {
      toast.error(errMsg(e, "Silinemedi."));
    } finally {
      setBusy(false);
    }
  };

  const pickTeam = async (p: Player, team: "black" | "white") => {
    const token = tokens[p.id];
    if (!token) return;
    setBusy(true);
    try {
      await teamFn({ data: { id: p.id, token, team: p.team === team ? null : team } });
      load();
    } catch (e) {
      toast.error(errMsg(e, "Takım seçilemedi."));
    } finally {
      setBusy(false);
    }
  };

  const resetWeek = async () => {
    setBusy(true);
    try {
      await resetFn({ data: { password } });
      saveTokens({});
      setPassword("");
      setAdminOpen(false);
      toast.success("Yeni hafta için liste temizlendi.");
      load();
    } catch (e) {
      toast.error(errMsg(e, "Sıfırlanamadı."));
    } finally {
      setBusy(false);
    }
  };

  const whites = squad.filter((p) => p.team === "white");
  const blacks = squad.filter((p) => p.team === "black");
  const card = "rounded-2xl border border-border bg-card p-4";
  const shadow = { boxShadow: "var(--shadow-card)" };

  return (
    <div className="min-h-screen bg-background pb-16 font-sans">
      <Toaster position="top-center" />

      <header className="sticky top-0 z-20 bg-pitch text-pitch-foreground">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <img src="/favicon.png" alt="" className="h-8 w-8 shrink-0 rounded-full" />
          <h1 className="truncate text-lg font-bold">Halı Saha Grubu</h1>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg space-y-4 px-4 pt-4">
        <section className="rounded-2xl bg-pitch p-5 text-pitch-foreground" style={shadow}>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">
            Bu Haftaki Maç
          </p>
          <p className="mt-1 text-2xl font-bold">Kadroya yazıl</p>
          <p className="mt-1 text-sm opacity-70">
            Şifre yok, üyelik yok. İsmini yaz, sıranı kap.
          </p>
          <Button
            onClick={join}
            disabled={busy}
            className="mt-4 h-13 w-full rounded-xl py-3 text-base font-bold uppercase tracking-wide"
            style={{ background: "var(--gradient-primary)" }}
          >
            Maça Yazıl
          </Button>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") join();
            }}
            placeholder="İsim"
            className="mt-3 h-12 rounded-xl border-0 bg-card text-center text-base text-card-foreground"
          />
        </section>

        <section className={card} style={shadow}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Bu Haftaki Kadro</h2>
            <span className="text-sm font-semibold">
              {squad.length} / {SQUAD_SIZE}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${(squad.length / SQUAD_SIZE) * 100}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Ring value={whiteCount} max={TEAM_SIZE} label="Beyaz Takım" />
            <Ring value={blackCount} max={TEAM_SIZE} label="Siyah Takım" />
            <Ring value={subs.length} max={Math.max(subs.length, 1)} label="Yedek" warn />
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3">
          <TeamCard title="Beyaz Takım" list={whites} dark={false} />
          <TeamCard title="Siyah Takım" list={blacks} dark />
        </section>

        <section className={card} style={shadow}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">As Kadro</h2>
            <span className="text-xs text-muted-foreground">Takım · Durum</span>
          </div>
          <ul className="mt-2 divide-y divide-border">
            {loading && (
              <li className="py-6 text-center text-sm text-muted-foreground">Yükleniyor...</li>
            )}
            {!loading && squad.length === 0 && (
              <li className="py-6 text-center text-sm text-muted-foreground">
                Henüz kimse yazılmadı. İlk sen ol!
              </li>
            )}
            {squad.map((p, i) => (
              <li key={p.id} className="py-3">
                <div className="flex items-center gap-3">
                  <span className="w-4 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                  <Avatar name={p.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {gun(p.created_at)} · {saat(p.created_at)}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
                    Geliyor
                  </span>
                </div>
                {isMine(p) ? (
                  <div className="mt-2 flex items-center gap-2 pl-7">
                    <TeamBtn
                      active={p.team === "white"}
                      disabled={busy || (p.team !== "white" && whiteCount >= TEAM_SIZE)}
                      onClick={() => pickTeam(p, "white")}
                      label="Beyaz Takım"
                    />
                    <TeamBtn
                      active={p.team === "black"}
                      disabled={busy || (p.team !== "black" && blackCount >= TEAM_SIZE)}
                      onClick={() => pickTeam(p, "black")}
                      label="Siyah Takım"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => leave(p)}
                      className="ml-auto shrink-0 text-xs font-semibold text-destructive"
                    >
                      Maçtan Çık
                    </button>
                  </div>
                ) : (
                  (p.team || adminMode) && (
                    <div className="mt-1 flex items-center pl-7 text-xs text-muted-foreground">
                      {p.team && <span>{p.team === "white" ? "Beyaz Takım" : "Siyah Takım"}</span>}
                      {adminMode && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => adminKick(p)}
                          className="ml-auto font-semibold text-destructive"
                        >
                          Çıkar
                        </button>
                      )}
                    </div>
                  )
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className={card} style={shadow}>
          <div className="flex items-center justify-between">
            <h2 className="font-bold">Yedekler Listesi</h2>
            <span className="text-sm text-muted-foreground">{subs.length}</span>
          </div>
          <div className="mt-3 rounded-xl bg-accent p-3 text-xs text-accent-foreground">
            As kadrodan biri çıkarsa, yedek sırasındaki ilk kişi otomatik olarak kadroya girer.
          </div>
          <ul className="mt-2 divide-y divide-border">
            {subs.length === 0 && (
              <li className="py-5 text-center text-sm text-muted-foreground">Yedek yok.</li>
            )}
            {subs.map((p, i) => (
              <li key={p.id} className="flex items-center gap-3 py-3">
                <span className="w-4 shrink-0 text-xs text-muted-foreground">{i + 1}</span>
                <Avatar name={p.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Yedek {i + 1} · {saat(p.created_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                    i === 0 ? "bg-warning text-warning-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {i === 0 ? "Sırada" : "Bekliyor"}
                </span>
                {isMine(p) ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => leave(p)}
                    className="shrink-0 text-xs font-semibold text-destructive"
                  >
                    Çık
                  </button>
                ) : (
                  adminMode && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => adminKick(p)}
                      className="shrink-0 text-xs font-semibold text-destructive"
                    >
                      Çıkar
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="pt-6 text-center">
          {!adminOpen ? (
            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              className="text-xs uppercase tracking-[0.2em] text-muted-foreground/60"
            >
              Yönetici
            </button>
          ) : (
            <div className={card}>
              {!adminMode ? (
                <>
                  <p className="text-sm text-muted-foreground">Yönetici şifresini gir.</p>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && password) adminEnter();
                    }}
                    placeholder="Yönetici şifresi"
                    className="mt-3 h-11 rounded-xl text-center"
                  />
                  <div className="mt-3 flex justify-center gap-2">
                    <Button disabled={busy || !password} onClick={adminEnter} className="rounded-xl font-bold">
                      Giriş
                    </Button>
                    <Button variant="ghost" onClick={() => setAdminOpen(false)} className="rounded-xl">
                      Kapat
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Yönetici modu açık. Listede her ismin yanında "Çıkar" görünür.
                  </p>
                  <div className="mt-3 flex justify-center gap-2">
                    <Button variant="destructive" disabled={busy} onClick={resetWeek} className="rounded-xl font-bold uppercase">
                      Haftayı Sıfırla
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setAdminMode(false);
                        setPassword("");
                        setAdminOpen(false);
                      }}
                      className="rounded-xl"
                    >
                      Çıkış
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function initials(n: string) {
  return n
    .split(/\s+/)
    .filter(Boolean)
    .map((x) => x[0])
    .join("")
    .slice(0, 2)
    .toLocaleUpperCase("tr-TR");
}

function Avatar({ name }: { name: string }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pitch text-xs font-bold text-pitch-foreground">
      {initials(name)}
    </span>
  );
}

function Ring({ value, max, label, warn }: { value: number; max: number; label: string; warn?: boolean }) {
  const pct = Math.min(value / max, 1);
  const c = 2 * Math.PI * 22;
  return (
    <div className="flex flex-col items-center rounded-xl border border-border py-3">
      <svg viewBox="0 0 52 52" className="h-14 w-14 -rotate-90">
        <circle cx="26" cy="26" r="22" fill="none" stroke="var(--secondary)" strokeWidth="4" />
        <circle
          cx="26"
          cy="26"
          r="22"
          fill="none"
          stroke={warn ? "var(--warning)" : "var(--primary)"}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
        <text x="26" y="31" textAnchor="middle" className="rotate-90 fill-foreground text-[14px] font-bold" style={{ transformOrigin: "26px 26px" }}>
          {value}
        </text>
      </svg>
      <span className="mt-1 text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}

function TeamCard({ title, list, dark }: { title: string; list: Player[]; dark: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-3 ${dark ? "border-pitch bg-pitch text-pitch-foreground" : "border-border bg-card"}`}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center gap-2">
        <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0" fill={dark ? "var(--team-black)" : "var(--team-white)"} stroke="currentColor" strokeWidth="1.3">
          <path d="M8 3 4 5 2 10l3 1.5V21h14v-9.5L22 10l-2-5-4-2c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3Z" />
        </svg>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold">{title}</p>
          <p className="text-xs opacity-70">
            {list.length} / {TEAM_SIZE}
          </p>
        </div>
      </div>
      <ol className="mt-2 space-y-1.5">
        {list.length === 0 && <li className="text-xs opacity-60">Henüz seçen yok</li>}
        {list.map((p, i) => (
          <li key={p.id} className="flex items-center gap-2 text-xs">
            <span className="w-3 opacity-60">{i + 1}</span>
            <span className="truncate">{p.name}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TeamBtn({ active, disabled, onClick, label }: { active: boolean; disabled: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors disabled:opacity-35 ${
        active ? "border-primary bg-accent text-accent-foreground" : "border-border text-muted-foreground"
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full border ${active ? "border-primary bg-primary" : "border-muted-foreground"}`} />
      {label}
    </button>
  );
}
