DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS inventory_movements CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS payment_refunds CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS hall_tasks CASCADE;
DROP TABLE IF EXISTS order_item_options CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS table_sessions CASCADE;
DROP TABLE IF EXISTS menu_option_choices CASCADE;
DROP TABLE IF EXISTS menu_item_options CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS menu_categories CASCADE;
DROP TABLE IF EXISTS terminals CASCADE;
DROP TABLE IF EXISTS cafe_tables CASCADE;

CREATE TABLE cafe_tables (
    id VARCHAR(50) PRIMARY KEY,
    table_code VARCHAR(30) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    seat_count INTEGER NOT NULL DEFAULT 2,
    status VARCHAR(30) NOT NULL DEFAULT 'available',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE terminals (
    id VARCHAR(50) PRIMARY KEY,
    terminal_code VARCHAR(50) NOT NULL UNIQUE,
    terminal_type VARCHAR(30) NOT NULL,
    table_id VARCHAR(50) REFERENCES cafe_tables(id),
    display_name VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (terminal_type IN ('customer', 'kitchen', 'hall', 'checkout', 'analytics'))
);

CREATE TABLE users (
    id VARCHAR(50) PRIMARY KEY,
    login_id VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    password_hash TEXT NOT NULL,
    password_hash_version VARCHAR(50) NOT NULL DEFAULT 'salted_sha256_v1',
    password_updated_at TIMESTAMP,
    failed_login_count INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMP,
    role VARCHAR(50) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (role IN ('manager', 'cashier', 'kitchen', 'hall', 'viewer'))
);

CREATE TABLE user_sessions (
    id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id),
    session_token VARCHAR(255) NOT NULL UNIQUE,
    terminal_code VARCHAR(100),
    expires_at TIMESTAMP NOT NULL,
    revoked_at TIMESTAMP,
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TIMESTAMP
);

CREATE TABLE menu_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_items (
    id VARCHAR(50) PRIMARY KEY,
    category_id VARCHAR(50) NOT NULL REFERENCES menu_categories(id),
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL,
    cost_price INTEGER NOT NULL DEFAULT 0,
    tax_rate INTEGER NOT NULL DEFAULT 10,
    image_url TEXT,
    kitchen_station VARCHAR(50) NOT NULL DEFAULT 'main',
    allergy_note TEXT NOT NULL DEFAULT '',
    sold_out BOOLEAN NOT NULL DEFAULT FALSE,
    track_stock BOOLEAN NOT NULL DEFAULT FALSE,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (price >= 0),
    CHECK (cost_price >= 0),
    CHECK (stock_quantity >= 0),
    CHECK (low_stock_threshold >= 0)
);

CREATE INDEX IF NOT EXISTS idx_menu_items_stock ON menu_items (track_stock, stock_quantity);

CREATE TABLE inventory_movements (
    id VARCHAR(50) PRIMARY KEY,
    menu_item_id VARCHAR(50) NOT NULL REFERENCES menu_items(id),
    movement_type VARCHAR(50) NOT NULL,
    quantity_delta INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    source_type VARCHAR(50),
    source_id VARCHAR(100),
    order_id VARCHAR(50),
    order_item_id VARCHAR(50),
    actor_user_id VARCHAR(50),
    actor_user_display_name VARCHAR(100),
    actor_user_role VARCHAR(50),
    actor_terminal_code VARCHAR(100),
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (movement_type IN ('manual_set', 'manual_adjust', 'order_reserved', 'order_cancel_restored', 'auto_sold_out')),
    CHECK (quantity_before >= 0),
    CHECK (quantity_after >= 0),
    CHECK (quantity_delta <> 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_item_time ON inventory_movements (menu_item_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type_time ON inventory_movements (movement_type, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order_item ON inventory_movements (order_item_id);

CREATE TABLE menu_item_options (
    id VARCHAR(50) PRIMARY KEY,
    item_id VARCHAR(50) NOT NULL REFERENCES menu_items(id),
    name VARCHAR(100) NOT NULL,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    multi_select BOOLEAN NOT NULL DEFAULT FALSE,
    min_select INTEGER NOT NULL DEFAULT 0,
    max_select INTEGER,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (min_select >= 0),
    CHECK (max_select IS NULL OR max_select >= min_select)
);

CREATE TABLE menu_option_choices (
    id VARCHAR(50) PRIMARY KEY,
    option_id VARCHAR(50) NOT NULL REFERENCES menu_item_options(id),
    name VARCHAR(100) NOT NULL,
    price_delta INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE table_sessions (
    id VARCHAR(50) PRIMARY KEY,
    table_id VARCHAR(50) NOT NULL REFERENCES cafe_tables(id),
    status VARCHAR(30) NOT NULL DEFAULT 'seated',
    guest_count INTEGER NOT NULL DEFAULT 1,
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_requested_at TIMESTAMP,
    closed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('seated', 'ordering', 'payment_requested', 'paid', 'closed'))
);

CREATE TABLE orders (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES table_sessions(id),
    order_no VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'submitted',
    subtotal INTEGER NOT NULL DEFAULT 0,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('submitted', 'in_progress', 'ready', 'served', 'cancelled', 'closed'))
);

CREATE TABLE order_items (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id),
    menu_item_id VARCHAR(50) NOT NULL REFERENCES menu_items(id),
    item_name VARCHAR(100) NOT NULL,
    unit_price INTEGER NOT NULL,
    unit_cost_price INTEGER NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ordered',
    kitchen_station VARCHAR(50) NOT NULL DEFAULT 'main',
    allergy_note TEXT NOT NULL DEFAULT '',
    customer_note TEXT NOT NULL DEFAULT '',
    accepted_at TIMESTAMP,
    cooking_started_at TIMESTAMP,
    ready_at TIMESTAMP,
    served_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (unit_cost_price >= 0),
    CHECK (quantity BETWEEN 1 AND 99),
    CHECK (status IN ('ordered', 'accepted', 'cooking', 'ready', 'served', 'cancelled'))
);

CREATE TABLE order_item_options (
    id VARCHAR(50) PRIMARY KEY,
    order_item_id VARCHAR(50) NOT NULL REFERENCES order_items(id),
    option_name VARCHAR(100) NOT NULL,
    choice_name VARCHAR(100) NOT NULL,
    price_delta INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE hall_tasks (
    id VARCHAR(50) PRIMARY KEY,
    task_type VARCHAR(30) NOT NULL,
    session_id VARCHAR(50) NOT NULL REFERENCES table_sessions(id),
    table_id VARCHAR(50) NOT NULL REFERENCES cafe_tables(id),
    order_item_id VARCHAR(50) REFERENCES order_items(id),
    status VARCHAR(30) NOT NULL DEFAULT 'todo',
    priority INTEGER NOT NULL DEFAULT 50,
    title VARCHAR(200) NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    assigned_to VARCHAR(100),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (task_type IN ('serve_item', 'staff_call', 'checkout_support', 'clean_table')),
    CHECK (status IN ('todo', 'doing', 'done', 'cancelled'))
);

CREATE TABLE payments (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES table_sessions(id),
    payment_no VARCHAR(50) NOT NULL UNIQUE,
    method VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'paid',
    subtotal INTEGER NOT NULL,
    tax_amount INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (method IN ('cash', 'card', 'qr')),
    CHECK (status IN ('pending', 'paid', 'failed', 'refunded'))
);

CREATE TABLE payment_refunds (
    id VARCHAR(50) PRIMARY KEY,
    payment_id VARCHAR(50) NOT NULL REFERENCES payments(id),
    refund_no VARCHAR(50) NOT NULL UNIQUE,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'refunded',
    refunded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_user_id VARCHAR(50),
    actor_user_display_name VARCHAR(100),
    actor_user_role VARCHAR(50),
    actor_terminal_code VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (amount > 0),
    CHECK (status IN ('refunded', 'failed', 'cancelled'))
);

CREATE TABLE audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor_terminal_code VARCHAR(100),
    actor_terminal_type VARCHAR(50),
    actor_user_id VARCHAR(50),
    actor_user_display_name VARCHAR(100),
    actor_user_role VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(100) NOT NULL,
    target_id VARCHAR(100),
    target_label VARCHAR(255),
    status VARCHAR(20) NOT NULL,
    before_data JSONB,
    after_data JSONB,
    request_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_table_sessions_table_status ON table_sessions(table_id, status);
CREATE INDEX idx_users_login_id ON users(login_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);
CREATE INDEX idx_orders_session_status ON orders(session_id, status);
CREATE INDEX idx_order_items_status_created ON order_items(status, created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_hall_tasks_status_created ON hall_tasks(status, created_at);
CREATE INDEX idx_payments_paid_at ON payments(paid_at);
CREATE INDEX idx_payment_refunds_payment_id ON payment_refunds(payment_id);
CREATE INDEX idx_payment_refunds_refunded_at ON payment_refunds(refunded_at DESC);
CREATE INDEX idx_audit_logs_occurred_at ON audit_logs (occurred_at DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs (action);
CREATE INDEX idx_audit_logs_target_type_id ON audit_logs (target_type, target_id);
CREATE INDEX idx_audit_logs_actor_terminal_code ON audit_logs (actor_terminal_code);
CREATE INDEX idx_audit_logs_actor_user_id ON audit_logs (actor_user_id);
CREATE INDEX idx_audit_logs_actor_user_role ON audit_logs (actor_user_role);
CREATE INDEX idx_audit_logs_status ON audit_logs (status);
