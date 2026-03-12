-- =============================================================================
-- Migration: 016_seed_service_staff_images.sql
-- Seeds image_url for all demo services and staff
-- =============================================================================

-- ── Staff Images ──────────────────────────────────────────────────────────────
-- Professional headshot-style images for each staff member

-- Milpitas Fades Barbershop (tenant 01)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000001'; -- Marcus Johnson
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1506277886164-e25aa3f4ef7f?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000002'; -- DeShawn Williams
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000003'; -- Andre Davis

-- Zen Garden Spa (tenant 02)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000004'; -- Yuki Tanaka
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000005'; -- Mei Lin Wong
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000006'; -- Aisha Patel
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000007'; -- Jasmine Lee

-- Sunrise Yoga (tenant 03)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000008'; -- Priya Sharma
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000009'; -- Luna Rivera
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000010'; -- Raj Kapoor

-- Peak Performance (tenant 04)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000011'; -- David Chen

-- Milpitas Family Dental (tenant 05)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000012'; -- Dr. Sarah Kim
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000013'; -- Dr. Kevin Pham
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000014'; -- Dr. Lisa Chang

-- Glow Skin Studio (tenant 06)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000015'; -- Isabella Rodriguez
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000016'; -- Sofia Nguyen

-- Luxe Nails (tenant 07)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000017'; -- Linh Nguyen
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000018'; -- Kim Tran
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000019'; -- Mai Hoang

-- FitZone (tenant 08)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1568602471122-7832951cc4c5?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000020'; -- Jake Thompson
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1548690312-e3b507d8c110?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000021'; -- Brittany Moore

-- Mindful Therapy (tenant 09)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1607746882042-944635dfe10e?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000022'; -- Dr. Amanda Foster
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000023'; -- Dr. James Morton

-- SV Chiropractic (tenant 10)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1537368910025-700350fe46c7?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000024'; -- Dr. Robert Lee
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1573497019940-1c28c88b4f3e?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000025'; -- Dr. Nina Gupta

-- Lash & Brow (tenant 11)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1508214751196-bcfd4ca60f91?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000026'; -- Megan Park
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1502767089025-6572583495f0?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000027'; -- Hannah Cho

-- Music Academy (tenant 12)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000028'; -- Carlos Martinez
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1499952127939-9bbf5af6c51c?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000029'; -- Diana Popov
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1463453091185-61582044d556?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000030'; -- Marcus Bell

-- Happy Paws (tenant 13)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1546961342-ea5f71b193f3?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000031'; -- Emily Watson
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1552058544-f2b08422138a?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000032'; -- Alex Ruiz

-- Elite Auto (tenant 14)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1504257432389-52343af06ae3?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000033'; -- Tony Reeves
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1564564321837-a57b7070ac4f?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000034'; -- Miguel Santos

-- NutriLife (tenant 15)
UPDATE staff SET image_url = 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=200&h=200&fit=crop&crop=face' WHERE id = 'c0000001-0000-0000-0000-000000000035'; -- Rachel Green


-- ── Service Images ────────────────────────────────────────────────────────────
-- Relevant images for each service type

-- Milpitas Fades Barbershop services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000001'; -- Classic Haircut
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000002'; -- Skin Fade
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000003'; -- Beard Trim
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000004'; -- Haircut + Beard
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1585747860830-63ab9dfd12f3?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000005'; -- Kids Haircut

-- Zen Garden Spa services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000006'; -- Swedish Massage
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000007'; -- Deep Tissue Massage
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000008'; -- Hot Stone Massage
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000009'; -- Signature Facial
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000010'; -- Couples Massage
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000011'; -- Body Scrub & Wrap

-- Sunrise Yoga services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000012'; -- Vinyasa Flow
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000013'; -- Gentle Yoga
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000014'; -- Hot Yoga
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1575052814086-f385e2e2ad1b?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000015'; -- Private Yoga
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1508672019048-805c876b67e2?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000016'; -- Meditation

-- Peak Performance services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000017'; -- Discovery Session
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000018'; -- Executive Coaching
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000019'; -- Career Strategy
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000020'; -- Leadership Workshop

-- Milpitas Family Dental services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000021'; -- Dental Cleaning
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000022'; -- Dental Exam
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1606265752439-1f18756aa5fc?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000023'; -- Teeth Whitening
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000024'; -- Emergency Consultation

-- Glow Skin Studio services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000025'; -- Hydrating Facial
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000026'; -- Anti-Aging Facial
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000027'; -- Chemical Peel
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1636377235305-340af4f2e929?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000028'; -- LED Light Therapy
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000029'; -- Microdermabrasion

-- Luxe Nails services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000030'; -- Classic Manicure
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1610992015732-2449b76344bc?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000031'; -- Gel Manicure
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000032'; -- Classic Pedicure
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1562322140-8baeececf08b?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000033'; -- Spa Pedicure
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000034'; -- Acrylic Full Set
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000035'; -- Nail Art

-- FitZone services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000036'; -- 1-on-1 Training
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000037'; -- Small Group Training
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000038'; -- Fitness Assessment
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000039'; -- HIIT Bootcamp

-- Mindful Therapy services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000040'; -- Individual Therapy
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1591035897819-f4bdf739f446?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000041'; -- Couples Therapy
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000042'; -- Anxiety Management
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000043'; -- Initial Consultation

-- SV Chiropractic services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000044'; -- Chiropractic Adjustment
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000045'; -- New Patient Exam
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000046'; -- Sports Injury Rehab
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000047'; -- Spinal Decompression

-- Lash & Brow services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000048'; -- Classic Lash Extensions
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000049'; -- Volume Lash Extensions
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000050'; -- Lash Fill
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000051'; -- Brow Lamination
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1616394584738-fc6e612e71b9?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000052'; -- Brow Tint & Shape
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1583001931096-959e9a1a6223?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000053'; -- Lash Lift & Tint

-- Music Academy services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000054'; -- Guitar 30min
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1510915361894-db8b60106cb1?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000055'; -- Guitar 60min
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000056'; -- Piano 30min
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1520523839897-bd0b52f945a0?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000057'; -- Piano 60min
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1519892300165-cb5542fb47c7?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000058'; -- Drum Lesson
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1516280440614-37939bbacd81?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000059'; -- Voice Lesson
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000060'; -- Trial Lesson

-- Happy Paws services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000061'; -- Small Dog Groom
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000062'; -- Large Dog Groom
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1516734212186-a967f81ad0d7?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000063'; -- Bath & Brush
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1583337130417-13571195a068?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000064'; -- Nail Trim
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1592194996308-7b43878e84a6?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000065'; -- Cat Grooming

-- Elite Auto services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000066'; -- Express Wash
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1507136566006-cfc505b114fc?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000067'; -- Interior Detail
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1601362840469-51e4d8d58785?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000068'; -- Full Detail
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000069'; -- Paint Correction
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1489824904134-891ab64532f1?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000070'; -- Headlight Restoration

-- NutriLife services
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000071'; -- Nutrition Assessment
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1505576399279-0b2a1b2e3d8a?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000072'; -- Follow-up
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000073'; -- Meal Prep Workshop
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000074'; -- Weight Management
UPDATE services SET image_url = 'https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=400&h=200&fit=crop' WHERE id = 'd0000001-0000-0000-0000-000000000075'; -- Discovery Call
