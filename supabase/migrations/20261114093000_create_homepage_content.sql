-- The live project is missing homepage_content, so admin homepage management returns 404.

CREATE TABLE IF NOT EXISTS public.homepage_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_name text NOT NULL,
  title text NOT NULL,
  description text,
  image_url text,
  link_url text,
  order_index integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.homepage_content ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active homepage content" ON public.homepage_content;
CREATE POLICY "Anyone can view active homepage content"
  ON public.homepage_content
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins can manage homepage content" ON public.homepage_content;
CREATE POLICY "Admins can manage homepage content"
  ON public.homepage_content
  FOR ALL
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

GRANT SELECT ON public.homepage_content TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.homepage_content TO authenticated;

INSERT INTO public.homepage_content (section_name, title, description, image_url, link_url, order_index)
SELECT seed.section_name, seed.title, seed.description, seed.image_url, seed.link_url, seed.order_index
FROM (
  VALUES
    (
      'hero',
      'Transform Your Future with KIKI',
      'Master essential soft skills through our comprehensive programs designed for students and professionals.',
      'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80',
      '/programs',
      1
    ),
    (
      'featured',
      'Communication Excellence',
      'Develop confident communication skills that open doors to new opportunities.',
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      '/programs',
      2
    ),
    (
      'featured',
      'Leadership Development',
      'Build leadership capabilities that inspire teams and drive success.',
      'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      '/programs',
      3
    ),
    (
      'testimonial',
      'Student Success Story',
      '"KIKI transformed my confidence and helped me land my dream job!"',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&q=80',
      NULL,
      4
    ),
    (
      'trusted_partners',
      'Madurai Kamaraj University',
      'Leading University in Tamil Nadu',
      'https://raw.githubusercontent.com/softskillmam/kiki-learn-grow-21/main/public/lovable-uploads/b39e0e16-a383-4d82-ab0f-0e9a52835b1d.png',
      'https://mkuniversity.ac.in/',
      1
    ),
    (
      'trusted_partners',
      'Kalasalingam University',
      'Excellence in Engineering & Technology',
      'https://raw.githubusercontent.com/softskillmam/kiki-learn-grow-21/main/public/lovable-uploads/b39e0e16-a383-4d82-ab0f-0e9a52835b1d.png',
      'https://kalasalingam.ac.in/',
      2
    ),
    (
      'trusted_partners',
      'Tamil Nadu Skill Development',
      'Government Skills Initiative',
      'https://raw.githubusercontent.com/softskillmam/kiki-learn-grow-21/main/public/lovable-uploads/b39e0e16-a383-4d82-ab0f-0e9a52835b1d.png',
      'https://www.skillmissiontn.gov.in/',
      3
    ),
    (
      'trusted_partners_header',
      'Globally Trusted Partners',
      'Globally trusted for delivering impactful learning outcomes',
      NULL,
      NULL,
      0
    )
) AS seed(section_name, title, description, image_url, link_url, order_index)
WHERE NOT EXISTS (
  SELECT 1 FROM public.homepage_content
);
