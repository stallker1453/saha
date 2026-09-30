ALTER TABLE public.players ADD COLUMN photo_url text, ADD COLUMN goals integer NOT NULL DEFAULT 0;

CREATE TABLE public.matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_date date NOT NULL,
  white_goals integer NOT NULL DEFAULT 0,
  black_goals integer NOT NULL DEFAULT 0,
  roster jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view matches" ON public.matches FOR SELECT USING (true);
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;