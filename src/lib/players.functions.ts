import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TEAM_SIZE = 7;
const SQUAD_SIZE = 14;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function checkOwner(id: string, token: string) {
  const db = await admin();
  const { data } = await db.from("player_tokens").select("token").eq("player_id", id).maybeSingle();
  if (!data || data.token !== token) throw new Error("Bu kayıt size ait değil.");
  return db;
}

export const joinMatch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ name: z.string().trim().min(2).max(40) }).parse(d))
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: row, error } = await db.from("players").insert({ name: data.name }).select("id").single();
    if (error || !row) throw new Error("Kayıt yapılamadı.");
    const token = crypto.randomUUID() + crypto.randomUUID();
    const { error: e2 } = await db.from("player_tokens").insert({ player_id: row.id, token });
    if (e2) {
      await db.from("players").delete().eq("id", row.id);
      throw new Error("Kayıt yapılamadı.");
    }
    return { id: row.id, token };
  });

export const pickTeam = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({ id: z.string().uuid(), token: z.string().min(10), team: z.enum(["black", "white"]).nullable() })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await checkOwner(data.id, data.token);
    if (data.team) {
      const { data: all } = await db.from("players").select("id,team").order("created_at", { ascending: true });
      const squad = (all ?? []).slice(0, SQUAD_SIZE);
      if (!squad.some((p) => p.id === data.id)) throw new Error("Sadece as kadro takım seçebilir.");
      const count = squad.filter((p) => p.team === data.team && p.id !== data.id).length;
      if (count >= TEAM_SIZE) throw new Error("Bu takım dolu.");
    }
    const { error } = await db.from("players").update({ team: data.team }).eq("id", data.id);
    if (error) throw new Error("Takım seçilemedi.");
    return { ok: true };
  });

export const leaveMatch = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), token: z.string().min(10) }).parse(d))
  .handler(async ({ data }) => {
    const db = await checkOwner(data.id, data.token);
    const { error } = await db.from("players").delete().eq("id", data.id);
    if (error) throw new Error("Silinemedi.");
    return { ok: true };
  });

export const setGoals = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ id: z.string().uuid(), token: z.string().min(10), goals: z.number().int().min(0).max(30) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await checkOwner(data.id, data.token);
    const { error } = await db.from("players").update({ goals: data.goals }).eq("id", data.id);
    if (error) throw new Error("Gol kaydedilemedi.");
    return { ok: true };
  });

export const setPhoto = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        token: z.string().min(10),
        photo: z.string().max(300_000).regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const db = await checkOwner(data.id, data.token);
    const { error } = await db.from("players").update({ photo_url: data.photo }).eq("id", data.id);
    if (error) throw new Error("Fotoğraf kaydedilemedi.");
    return { ok: true };
  });

function matchDay() {
  // Istanbul date of the most recent Friday (today if Friday)
  const now = new Date(Date.now() + 3 * 3600_000);
  const back = (now.getUTCDay() - 5 + 7) % 7;
  now.setUTCDate(now.getUTCDate() - back);
  return now.toISOString().slice(0, 10);
}

export const resetWeek = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_PASSWORD"];
    if (!expected || data.password !== expected) throw new Error("Yönetici şifresi yanlış.");
    const db = await admin();
    const { data: all } = await db.from("players").select("name,team,goals").order("created_at", { ascending: true });
    const squad = (all ?? []).slice(0, SQUAD_SIZE);
    if (squad.length > 0) {
      const sum = (t: string) => squad.filter((p) => p.team === t).reduce((a, p) => a + p.goals, 0);
      const { error: me } = await db.from("matches").insert({
        match_date: matchDay(),
        white_goals: sum("white"),
        black_goals: sum("black"),
        roster: squad,
      });
      if (me) throw new Error("Maç geçmişe kaydedilemedi.");
    }
    const { error } = await db.from("players").delete().not("id", "is", null);
    if (error) throw new Error("Sıfırlanamadı.");
    return { ok: true };
  });

function checkAdmin(password: string) {
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected || password !== expected) throw new Error("Yönetici şifresi yanlış.");
}

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    checkAdmin(data.password);
    return { ok: true };
  });

export const adminRemove = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ password: z.string().min(1).max(200), id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    checkAdmin(data.password);
    const db = await admin();
    const { error } = await db.from("players").delete().eq("id", data.id);
    if (error) throw new Error("Silinemedi.");
    return { ok: true };
  });
