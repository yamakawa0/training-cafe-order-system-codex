INSERT INTO cafe_tables (id, table_code, display_name, seat_count, status) VALUES
('tbl-t01', 'T01', '1番テーブル', 2, 'available'),
('tbl-t02', 'T02', '2番テーブル', 2, 'available'),
('tbl-t03', 'T03', '3番テーブル', 4, 'available'),
('tbl-t04', 'T04', '4番テーブル', 4, 'available');

INSERT INTO terminals (id, terminal_code, terminal_type, table_id, display_name) VALUES
('term-customer-t01', 'customer-T01', 'customer', 'tbl-t01', '顧客端末 1番テーブル'),
('term-customer-t02', 'customer-T02', 'customer', 'tbl-t02', '顧客端末 2番テーブル'),
('term-kitchen-main', 'kitchen-main', 'kitchen', NULL, 'キッチン端末'),
('term-hall-main', 'hall-main', 'hall', NULL, 'ホール端末'),
('term-checkout-main', 'checkout-main', 'checkout', NULL, 'レジ端末'),
('term-analytics-manager', 'analytics-manager', 'analytics', NULL, '店長 PC');

INSERT INTO users (id, login_id, display_name, password_hash, password_hash_version, password_updated_at, role, active) VALUES
('user-manager', 'manager', '店長', 'salted_sha256_v1$1ea3dc4e04b673feb5e1925bb0cb42da$a2d2a833cb687c7085a2a77dc62c3a242b453b1c0a1368896b9f77d9a328c671', 'salted_sha256_v1', CURRENT_TIMESTAMP, 'manager', TRUE),
('user-cashier', 'cashier', 'レジ担当', 'salted_sha256_v1$566fadab4d56dd18ffcc32ce733c221f$a6a72a50146489480ab5eb6b64eacf8fd5e3a898fd62f697d30f54ed3d02650b', 'salted_sha256_v1', CURRENT_TIMESTAMP, 'cashier', TRUE),
('user-kitchen', 'kitchen', 'キッチン担当', 'salted_sha256_v1$5f3407c3dab2514ee1cbd4516806cf45$0a2577085f8ae9bdd5a98aca4beabd00c8fd693b841d1230b32fae6aff2eb8e3', 'salted_sha256_v1', CURRENT_TIMESTAMP, 'kitchen', TRUE),
('user-hall', 'hall', 'ホール担当', 'salted_sha256_v1$eb3ce3a169e12c6cb2eb824a4a1c3b82$eec8fe633ce253108e83bf3121be5b160d526d7627469228efc3c2d637eb8c6c', 'salted_sha256_v1', CURRENT_TIMESTAMP, 'hall', TRUE),
('user-viewer', 'viewer', '閲覧担当', 'salted_sha256_v1$2875c97ae7c07aa83016a2798c9c2139$ec676dcc76b670437f25ac2887eab53a376c585e1c5bf0944e3c285f9706edd9', 'salted_sha256_v1', CURRENT_TIMESTAMP, 'viewer', TRUE);

INSERT INTO menu_categories (id, name, display_order) VALUES
('cat-coffee', 'Coffee', 10),
('cat-tea', 'Tea', 20),
('cat-food', 'Food', 30),
('cat-dessert', 'Dessert', 40);

INSERT INTO menu_items (
    id, category_id, name, description, price, tax_rate, image_url,
    kitchen_station, allergy_note, sold_out, track_stock, stock_quantity, low_stock_threshold, active, display_order
) VALUES
('item-blend', 'cat-coffee', 'ブレンドコーヒー', '深煎り豆を使った定番の一杯です。', 450, 10, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80', 'drink', '', FALSE, FALSE, 0, 0, TRUE, 10),
('item-latte', 'cat-coffee', 'カフェラテ', 'ミルクの甘みを感じるラテです。', 550, 10, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80', 'drink', '乳', FALSE, FALSE, 0, 0, TRUE, 20),
('item-iced-tea', 'cat-tea', 'アイスティー', '香りのよいストレートティーです。', 500, 10, 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?auto=format&fit=crop&w=900&q=80', 'drink', '', FALSE, FALSE, 0, 0, TRUE, 10),
('item-croque', 'cat-food', 'クロックムッシュ', 'ハムとチーズのホットサンドです。', 900, 10, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80', 'food', '小麦・乳・卵', FALSE, FALSE, 0, 0, TRUE, 10),
('item-cheesecake', 'cat-dessert', 'チーズケーキ', '濃厚でなめらかなベイクドチーズケーキです。', 650, 10, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80', 'dessert', '乳・卵・小麦', FALSE, FALSE, 0, 0, TRUE, 10),
('item-pudding', 'cat-dessert', '限定プリン', 'ほろ苦いカラメルの自家製プリンです。', 500, 10, 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80', 'dessert', '乳・卵', FALSE, TRUE, 3, 2, TRUE, 20);

INSERT INTO menu_item_options (id, item_id, name, required, multi_select, min_select, max_select, active, display_order) VALUES
('opt-blend-size', 'item-blend', 'サイズ', TRUE, FALSE, 1, 1, TRUE, 10),
('opt-latte-milk', 'item-latte', 'ミルク', TRUE, FALSE, 1, 1, TRUE, 10),
('opt-croque-side', 'item-croque', 'サイド', FALSE, TRUE, 0, 2, TRUE, 10);

INSERT INTO menu_option_choices (id, option_id, name, price_delta, display_order) VALUES
('choice-blend-regular', 'opt-blend-size', 'Regular', 0, 10),
('choice-blend-large', 'opt-blend-size', 'Large', 120, 20),
('choice-latte-milk', 'opt-latte-milk', '通常ミルク', 0, 10),
('choice-latte-soy', 'opt-latte-milk', '豆乳', 80, 20),
('choice-croque-salad', 'opt-croque-side', 'ミニサラダ', 180, 10),
('choice-croque-soup', 'opt-croque-side', '本日のスープ', 220, 20);
