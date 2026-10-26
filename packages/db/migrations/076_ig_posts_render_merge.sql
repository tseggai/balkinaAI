-- Migration 076: parallel studio renders. Renders of one post run concurrently (one request each), so a
-- render is merged into the jsonb atomically instead of read-modify-write; the Canva asset of the
-- photo is cached on the row so it is uploaded once per post.

ALTER TABLE ig_posts
  ADD COLUMN IF NOT EXISTS canva_asset_id    TEXT,   -- Canva asset id of photo_url
  ADD COLUMN IF NOT EXISTS canva_asset_photo TEXT;   -- the photo_url that asset was made from

CREATE OR REPLACE FUNCTION ig_posts_set_render(p_id UUID, p_format TEXT, p_lang TEXT, p_url TEXT, p_design TEXT, p_template UUID)
RETURNS SETOF ig_posts
LANGUAGE sql
AS $$
  UPDATE ig_posts SET
    renders       = jsonb_set(COALESCE(renders, '{}'::jsonb), ARRAY[p_format], COALESCE(renders -> p_format, '{}'::jsonb) || jsonb_build_object(p_lang, p_url), true),
    designs       = jsonb_set(COALESCE(designs, '{}'::jsonb), ARRAY[p_format], COALESCE(designs -> p_format, '{}'::jsonb) || jsonb_build_object(p_lang, p_design), true),
    template_sq_id = CASE WHEN p_format = 'sq' THEN p_template ELSE template_sq_id END,
    template_st_id = CASE WHEN p_format = 'st' THEN p_template ELSE template_st_id END,
    render_sq_url  = CASE WHEN p_format = 'sq' AND p_lang = lang THEN p_url ELSE render_sq_url END,
    render_st_url  = CASE WHEN p_format = 'st' AND p_lang = lang THEN p_url ELSE render_st_url END,
    design_sq_id   = CASE WHEN p_format = 'sq' AND p_lang = lang THEN p_design ELSE design_sq_id END,
    design_st_id   = CASE WHEN p_format = 'st' AND p_lang = lang THEN p_design ELSE design_st_id END,
    error = NULL,
    updated_at = now()
  WHERE id = p_id
  RETURNING *;
$$;
