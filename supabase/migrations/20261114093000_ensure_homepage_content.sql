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
      'Leading university in Madurai',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Madurai_Kamaraj_University.jpg/1280px-Madurai_Kamaraj_University.jpg',
      'https://mkuniversity.ac.in/',
      1
    ),
    (
      'trusted_partners',
      'Kalasalingam University',
      'Engineering and technology campus in Krishnankoil',
      'https://upload.wikimedia.org/wikipedia/commons/f/fd/Kalasalingam_University.jpg',
      'https://kalasalingam.ac.in/',
      2
    ),
    (
      'trusted_partners',
      'Tamil Nadu Skill Development',
      'State skills and employability programmes',
      'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1200&q=80',
      'https://www.skillmissiontn.gov.in/',
      3
    ),
    (
      'trusted_partners',
      'Anna University',
      'Engineering university in Chennai',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Anna_University.jpg/1280px-Anna_University.jpg',
      'https://www.annauniv.edu/',
      4
    ),
    (
      'trusted_partners',
      'Bharathiar University',
      'Public university in Coimbatore',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Bharathiar_University_entrance.jpg/1280px-Bharathiar_University_entrance.jpg',
      'https://b-u.ac.in/',
      5
    ),
    (
      'trusted_partners',
      'Alagappa University',
      'Public university in Karaikudi',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Alagappa_University.JPG/1280px-Alagappa_University.JPG',
      'https://alagappauniversity.ac.in/',
      6
    ),
    (
      'trusted_partners',
      'University of Madras',
      'Historic university in Chennai',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Madras_University_Senate_House.jpg/1280px-Madras_University_Senate_House.jpg',
      'https://www.unom.ac.in/',
      7
    ),
    (
      'trusted_partners',
      'Bharathidasan University',
      'Public university in Tiruchirappalli',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Bharathidasan_University_Campus_%2840250301172%29.jpg/1280px-Bharathidasan_University_Campus_%2840250301172%29.jpg',
      'https://www.bdu.ac.in/',
      8
    ),
    (
      'trusted_partners',
      'Manonmaniam Sundaranar University',
      'Public university in Tirunelveli',
      'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/A_inner_view_of_Manomaniam_Sundaranar_University_building.jpg/1280px-A_inner_view_of_Manomaniam_Sundaranar_University_building.jpg',
      'https://www.msuniv.ac.in/',
      9
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
