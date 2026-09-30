CREATE TABLE public.player_tokens (
  player_id uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  token text NOT NULL
);
GRANT ALL ON public.player_tokens TO service_role;
ALTER TABLE public.player_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can add players" ON public.players;
DROP POLICY IF EXISTS "Anyone can delete players" ON public.players;
DROP POLICY IF EXISTS "Anyone can update players" ON public.players;
REVOKE INSERT, UPDATE, DELETE ON public.players FROM anon, authenticated;
GRANT ALL ON public.players TO service_role;