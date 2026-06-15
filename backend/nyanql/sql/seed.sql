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

INSERT INTO users (id, login_id, display_name, password_hash, role, active) VALUES
('user-manager', 'manager', '店長', '866485796cfa8d7c0cf7111640205b83076433547577511d81f8030ae99ecea5', 'manager', TRUE),
('user-cashier', 'cashier', 'レジ担当', 'b4c94003c562bb0d89535eca77f07284fe560fd48a7cc1ed99f0a56263d616ba', 'cashier', TRUE),
('user-kitchen', 'kitchen', 'キッチン担当', 'e5cf9d8e3884bb2a899372b9fcb87af6fcd9b3aad2ff07e2c076b4a71ffad67c', 'kitchen', TRUE),
('user-hall', 'hall', 'ホール担当', '2e0fdaf025121060df4810c0c56b3e88b052d834039376cd4491d35762548ccf', 'hall', TRUE),
('user-viewer', 'viewer', '閲覧担当', '65375049b9e4d7cad6c9ba286fdeb9394b28135a3e84136404cfccfdcc438894', 'viewer', TRUE);

INSERT INTO menu_categories (id, name, display_order) VALUES
('cat-coffee', 'Coffee', 10),
('cat-tea', 'Tea', 20),
('cat-food', 'Food', 30),
('cat-dessert', 'Dessert', 40);

INSERT INTO menu_items (
    id, category_id, name, description, price, tax_rate, image_url,
    kitchen_station, allergy_note, sold_out, active, display_order
) VALUES
('item-blend', 'cat-coffee', 'ブレンドコーヒー', '深煎り豆を使った定番の一杯です。', 450, 10, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=900&q=80', 'drink', '', FALSE, TRUE, 10),
('item-latte', 'cat-coffee', 'カフェラテ', 'ミルクの甘みを感じるラテです。', 550, 10, 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?auto=format&fit=crop&w=900&q=80', 'drink', '乳', FALSE, TRUE, 20),
('item-iced-tea', 'cat-tea', 'アイスティー', '香りのよいストレートティーです。', 500, 10, 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?auto=format&fit=crop&w=900&q=80', 'drink', '', FALSE, TRUE, 10),
('item-croque', 'cat-food', 'クロックムッシュ', 'ハムとチーズのホットサンドです。', 900, 10, 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=900&q=80', 'food', '小麦・乳・卵', FALSE, TRUE, 10),
('item-cheesecake', 'cat-dessert', 'チーズケーキ', '濃厚でなめらかなベイクドチーズケーキです。', 650, 10, 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?auto=format&fit=crop&w=900&q=80', 'dessert', '乳・卵・小麦', FALSE, TRUE, 10),
('item-pudding', 'cat-dessert', 'プリン', 'ほろ苦いカラメルの自家製プリンです。', 500, 10, 'https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=900&q=80', 'dessert', '乳・卵', FALSE, TRUE, 20);

INSERT INTO menu_item_options (id, item_id, name, required, multi_select, display_order) VALUES
('opt-blend-size', 'item-blend', 'サイズ', TRUE, FALSE, 10),
('opt-latte-milk', 'item-latte', 'ミルク', TRUE, FALSE, 10),
('opt-croque-side', 'item-croque', 'サイド', FALSE, TRUE, 10);

INSERT INTO menu_option_choices (id, option_id, name, price_delta, display_order) VALUES
('choice-blend-regular', 'opt-blend-size', 'Regular', 0, 10),
('choice-blend-large', 'opt-blend-size', 'Large', 120, 20),
('choice-latte-milk', 'opt-latte-milk', '通常ミルク', 0, 10),
('choice-latte-soy', 'opt-latte-milk', '豆乳', 80, 20),
('choice-croque-salad', 'opt-croque-side', 'ミニサラダ', 180, 10),
('choice-croque-soup', 'opt-croque-side', '本日のスープ', 220, 20);
