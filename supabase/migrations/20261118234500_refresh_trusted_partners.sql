-- Replace the shared placeholder photo and add the remaining partner campuses.
-- Earlier partner migrations have already run, so this updates the live rows.

UPDATE public.homepage_content AS partner
SET
  description = seed.description,
  image_url = seed.image_url,
  link_url = seed.link_url,
  order_index = seed.order_index,
  updated_at = now()
FROM (
  VALUES
    ('Madurai Kamaraj University', 'Leading university in Madurai', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Madurai_Kamaraj_University.jpg/1280px-Madurai_Kamaraj_University.jpg', 'https://mkuniversity.ac.in/', 1),
    ('Kalasalingam University', 'Engineering and technology campus in Krishnankoil', 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Kalasalingam_University.jpg', 'https://kalasalingam.ac.in/', 2),
    ('Tamil Nadu Skill Development', 'State skills and employability programmes', 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1200&q=80', 'https://www.skillmissiontn.gov.in/', 3)
) AS seed(title, description, image_url, link_url, order_index)
WHERE partner.section_name = 'trusted_partners'
  AND partner.title = seed.title;

INSERT INTO public.homepage_content (section_name, title, description, image_url, link_url, order_index)
SELECT 'trusted_partners', seed.title, seed.description, seed.image_url, seed.link_url, seed.order_index
FROM (
  VALUES
    ('Anna University', 'Engineering university in Chennai', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Anna_University.jpg/1280px-Anna_University.jpg', 'https://www.annauniv.edu/', 4),
    ('Bharathiar University', 'Public university in Coimbatore', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Bharathiar_University_entrance.jpg/1280px-Bharathiar_University_entrance.jpg', 'https://b-u.ac.in/', 5),
    ('Alagappa University', 'Public university in Karaikudi', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Alagappa_University.JPG/1280px-Alagappa_University.JPG', 'https://alagappauniversity.ac.in/', 6),
    ('University of Madras', 'Historic university in Chennai', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Madras_University_Senate_House.jpg/1280px-Madras_University_Senate_House.jpg', 'https://www.unom.ac.in/', 7),
    ('Bharathidasan University', 'Public university in Tiruchirappalli', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Bharathidasan_University_Campus_%2840250301172%29.jpg/1280px-Bharathidasan_University_Campus_%2840250301172%29.jpg', 'https://www.bdu.ac.in/', 8),
    ('Manonmaniam Sundaranar University', 'Public university in Tirunelveli', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/A_inner_view_of_Manomaniam_Sundaranar_University_building.jpg/1280px-A_inner_view_of_Manomaniam_Sundaranar_University_building.jpg', 'https://www.msuniv.ac.in/', 9)
) AS seed(title, description, image_url, link_url, order_index)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.homepage_content AS existing
  WHERE existing.section_name = 'trusted_partners'
    AND existing.title = seed.title
);
