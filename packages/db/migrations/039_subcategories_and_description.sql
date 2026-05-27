-- Subcategories + tenant description for business type display

-- Add description to tenants
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS description TEXT;

-- Insert subcategories under each parent category
-- Beauty & Personal Care
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Barbershop', 'barbershop', 1 FROM categories WHERE slug = 'beauty-personal-care' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Hair Salon', 'hair-salon', 2 FROM categories WHERE slug = 'beauty-personal-care' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Nail Studio', 'nail-studio', 3 FROM categories WHERE slug = 'beauty-personal-care' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Spa', 'spa', 4 FROM categories WHERE slug = 'beauty-personal-care' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Lash & Brow Studio', 'lash-brow-studio', 5 FROM categories WHERE slug = 'beauty-personal-care' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Skincare Clinic', 'skincare-clinic', 6 FROM categories WHERE slug = 'beauty-personal-care' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Makeup Artist', 'makeup-artist', 7 FROM categories WHERE slug = 'beauty-personal-care' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Tattoo & Piercing', 'tattoo-piercing', 8 FROM categories WHERE slug = 'beauty-personal-care' ON CONFLICT DO NOTHING;

-- Health & Wellness
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Massage Therapy', 'massage-therapy', 1 FROM categories WHERE slug = 'health-wellness' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Chiropractic', 'chiropractic', 2 FROM categories WHERE slug = 'health-wellness' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Acupuncture', 'acupuncture', 3 FROM categories WHERE slug = 'health-wellness' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Counseling & Therapy', 'counseling-therapy', 4 FROM categories WHERE slug = 'health-wellness' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Physical Therapy', 'physical-therapy', 5 FROM categories WHERE slug = 'health-wellness' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Yoga & Meditation', 'yoga-meditation', 6 FROM categories WHERE slug = 'health-wellness' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Nutritionist', 'nutritionist', 7 FROM categories WHERE slug = 'health-wellness' ON CONFLICT DO NOTHING;

-- Fitness & Sports
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Personal Trainer', 'personal-trainer', 1 FROM categories WHERE slug = 'fitness-sports' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Gym', 'gym', 2 FROM categories WHERE slug = 'fitness-sports' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Martial Arts', 'martial-arts', 3 FROM categories WHERE slug = 'fitness-sports' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Dance Studio', 'dance-studio', 4 FROM categories WHERE slug = 'fitness-sports' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Swimming Coach', 'swimming-coach', 5 FROM categories WHERE slug = 'fitness-sports' ON CONFLICT DO NOTHING;

-- Home Services
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Cleaning Service', 'cleaning-service', 1 FROM categories WHERE slug = 'home-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Handyman', 'handyman', 2 FROM categories WHERE slug = 'home-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Plumber', 'plumber', 3 FROM categories WHERE slug = 'home-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Electrician', 'electrician', 4 FROM categories WHERE slug = 'home-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Landscaping', 'landscaping', 5 FROM categories WHERE slug = 'home-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Pest Control', 'pest-control', 6 FROM categories WHERE slug = 'home-services' ON CONFLICT DO NOTHING;

-- Professional Services
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Law Firm', 'law-firm', 1 FROM categories WHERE slug = 'professional-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Accounting', 'accounting', 2 FROM categories WHERE slug = 'professional-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Consulting', 'consulting', 3 FROM categories WHERE slug = 'professional-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'IT Services', 'it-services', 4 FROM categories WHERE slug = 'professional-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Photography', 'photography', 5 FROM categories WHERE slug = 'professional-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Real Estate', 'real-estate', 6 FROM categories WHERE slug = 'professional-services' ON CONFLICT DO NOTHING;

-- Education & Tutoring
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Math Tutor', 'math-tutor', 1 FROM categories WHERE slug = 'education-tutoring' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Language School', 'language-school', 2 FROM categories WHERE slug = 'education-tutoring' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Music Lessons', 'music-lessons', 3 FROM categories WHERE slug = 'education-tutoring' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Test Prep', 'test-prep', 4 FROM categories WHERE slug = 'education-tutoring' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Driving School', 'driving-school', 5 FROM categories WHERE slug = 'education-tutoring' ON CONFLICT DO NOTHING;

-- Pet Services
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Dog Grooming', 'dog-grooming', 1 FROM categories WHERE slug = 'pet-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Veterinary Clinic', 'veterinary-clinic', 2 FROM categories WHERE slug = 'pet-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Pet Boarding', 'pet-boarding', 3 FROM categories WHERE slug = 'pet-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Dog Training', 'dog-training', 4 FROM categories WHERE slug = 'pet-services' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Pet Sitting', 'pet-sitting', 5 FROM categories WHERE slug = 'pet-services' ON CONFLICT DO NOTHING;

-- Automotive
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Auto Repair', 'auto-repair', 1 FROM categories WHERE slug = 'automotive' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Car Wash', 'car-wash', 2 FROM categories WHERE slug = 'automotive' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Auto Detailing', 'auto-detailing', 3 FROM categories WHERE slug = 'automotive' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Tire Shop', 'tire-shop', 4 FROM categories WHERE slug = 'automotive' ON CONFLICT DO NOTHING;

-- Events & Entertainment
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'DJ', 'dj', 1 FROM categories WHERE slug = 'events-entertainment' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Event Planner', 'event-planner', 2 FROM categories WHERE slug = 'events-entertainment' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Catering', 'catering', 3 FROM categories WHERE slug = 'events-entertainment' ON CONFLICT DO NOTHING;

-- Food & Nutrition
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Meal Prep', 'meal-prep', 1 FROM categories WHERE slug = 'food-nutrition' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Personal Chef', 'personal-chef', 2 FROM categories WHERE slug = 'food-nutrition' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Dietitian', 'dietitian', 3 FROM categories WHERE slug = 'food-nutrition' ON CONFLICT DO NOTHING;

-- Rentals & Tours
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Boat Charter', 'boat-charter', 1 FROM categories WHERE slug = 'rentals-tours' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Tour Guide', 'tour-guide', 2 FROM categories WHERE slug = 'rentals-tours' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Equipment Rental', 'equipment-rental', 3 FROM categories WHERE slug = 'rentals-tours' ON CONFLICT DO NOTHING;
INSERT INTO categories (parent_id, name, slug, display_order) SELECT id, 'Travel Agency', 'travel-agency', 4 FROM categories WHERE slug = 'rentals-tours' ON CONFLICT DO NOTHING;
