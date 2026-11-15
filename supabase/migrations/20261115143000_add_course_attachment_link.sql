-- Program attachments stay in Google Drive. The share link is stored on the course.

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_url text;

COMMENT ON COLUMN public.courses.attachment_name IS 'Label for the program attachment download.';
COMMENT ON COLUMN public.courses.attachment_url IS 'Google Drive or Google Docs share link for the program attachment.';
