-- Add trusted partners/institutions to the homepage_content table
-- We'll use a new section_name called 'trusted_partners'
INSERT INTO public.homepage_content (section_name, title, description, image_url, link_url, order_index) VALUES
('trusted_partners', 'Madurai Kamaraj University', 'Leading university in Madurai', 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/Madurai_Kamaraj_University.jpg/1280px-Madurai_Kamaraj_University.jpg', 'https://mkuniversity.ac.in/', 1),
('trusted_partners', 'Kalasalingam University', 'Engineering and technology campus in Krishnankoil', 'https://upload.wikimedia.org/wikipedia/commons/f/fd/Kalasalingam_University.jpg', 'https://kalasalingam.ac.in/', 2),
('trusted_partners', 'Tamil Nadu Skill Development', 'State skills and employability programmes', 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?auto=format&fit=crop&w=1200&q=80', 'https://www.skillmissiontn.gov.in/', 3),
('trusted_partners', 'Anna University', 'Engineering university in Chennai', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Anna_University.jpg/1280px-Anna_University.jpg', 'https://www.annauniv.edu/', 4),
('trusted_partners', 'Bharathiar University', 'Public university in Coimbatore', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7c/Bharathiar_University_entrance.jpg/1280px-Bharathiar_University_entrance.jpg', 'https://b-u.ac.in/', 5),
('trusted_partners', 'Alagappa University', 'Public university in Karaikudi', 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/25/Alagappa_University.JPG/1280px-Alagappa_University.JPG', 'https://alagappauniversity.ac.in/', 6),
('trusted_partners', 'University of Madras', 'Historic university in Chennai', 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Madras_University_Senate_House.jpg/1280px-Madras_University_Senate_House.jpg', 'https://www.unom.ac.in/', 7),
('trusted_partners', 'Bharathidasan University', 'Public university in Tiruchirappalli', 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5d/Bharathidasan_University_Campus_%2840250301172%29.jpg/1280px-Bharathidasan_University_Campus_%2840250301172%29.jpg', 'https://www.bdu.ac.in/', 8),
('trusted_partners', 'Manonmaniam Sundaranar University', 'Public university in Tirunelveli', 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/A_inner_view_of_Manomaniam_Sundaranar_University_building.jpg/1280px-A_inner_view_of_Manomaniam_Sundaranar_University_building.jpg', 'https://www.msuniv.ac.in/', 9);

-- Add a section header for trusted partners
INSERT INTO public.homepage_content (section_name, title, description, order_index) VALUES
('trusted_partners_header', 'Globally Trusted Partners', 'Globally trusted for delivering impactful learning outcomes', 0);
