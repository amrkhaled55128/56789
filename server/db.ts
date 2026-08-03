import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

export type Role = 'owner' | 'manager' | 'reception' | 'doctor' | 'assistant' | 'pharmacist' | 'inventory' | 'accountant' | 'lab';
export type Species = 'قطة' | 'كلب';

export const databasePath = resolve(process.env.DATABASE_PATH ?? 'data/vet-clinic.sqlite');
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new DatabaseSync(databasePath);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');

export function localDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clients (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    whatsapp TEXT,
    email TEXT,
    address TEXT,
    notes TEXT,
    balance REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS pets (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    species TEXT NOT NULL CHECK (species IN ('قطة', 'كلب')),
    breed TEXT,
    sex TEXT,
    birth_date TEXT,
    color TEXT,
    weight_kg REAL,
    microchip TEXT,
    neutered INTEGER NOT NULL DEFAULT 0,
    allergies TEXT,
    chronic_conditions TEXT,
    status TEXT NOT NULL DEFAULT 'نشط',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id),
    pet_id TEXT NOT NULL REFERENCES pets(id),
    doctor_id TEXT REFERENCES users(id),
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    service TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'مؤكد',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id),
    pet_id TEXT NOT NULL REFERENCES pets(id),
    doctor_id TEXT REFERENCES users(id),
    visit_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'مفتوحة',
    chief_complaint TEXT,
    diagnosis TEXT,
    treatment_plan TEXT,
    temperature REAL,
    weight_kg REAL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT 'قطعة',
    sale_price REAL NOT NULL DEFAULT 0,
    purchase_price REAL NOT NULL DEFAULT 0,
    stock REAL NOT NULL DEFAULT 0,
    min_stock REAL NOT NULL DEFAULT 0,
    expiry_date TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    client_id TEXT REFERENCES clients(id),
    visit_id TEXT REFERENCES visits(id),
    subtotal REAL NOT NULL DEFAULT 0,
    discount REAL NOT NULL DEFAULT 0,
    tax REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0,
    paid REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'غير مدفوعة',
    payment_method TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vaccinations (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL REFERENCES pets(id),
    visit_id TEXT REFERENCES visits(id),
    doctor_id TEXT REFERENCES users(id),
    vaccine_name TEXT NOT NULL,
    dose TEXT,
    batch_number TEXT,
    expiry_date TEXT,
    administered_date TEXT NOT NULL,
    next_due_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS prescriptions (
    id TEXT PRIMARY KEY,
    visit_id TEXT NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    medication TEXT NOT NULL,
    dosage TEXT NOT NULL,
    frequency TEXT,
    duration TEXT,
    route TEXT,
    instructions TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoice_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    product_id TEXT REFERENCES products(id),
    item_type TEXT NOT NULL DEFAULT 'خدمة',
    description TEXT NOT NULL,
    quantity REAL NOT NULL DEFAULT 1,
    unit_price REAL NOT NULL DEFAULT 0,
    total REAL NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    amount REAL NOT NULL,
    method TEXT NOT NULL,
    reference TEXT,
    received_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS stock_movements (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES products(id),
    movement_type TEXT NOT NULL,
    quantity REAL NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    user_id TEXT REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lab_tests (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL REFERENCES pets(id),
    visit_id TEXT REFERENCES visits(id),
    doctor_id TEXT REFERENCES users(id),
    test_name TEXT NOT NULL,
    test_type TEXT NOT NULL DEFAULT 'تحليل عام',
    results_json TEXT,
    status TEXT NOT NULL DEFAULT 'مكتمل',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS medical_attachments (
    id TEXT PRIMARY KEY,
    pet_id TEXT NOT NULL REFERENCES pets(id),
    visit_id TEXT REFERENCES visits(id),
    category TEXT NOT NULL DEFAULT 'أشعة سينية',
    title TEXT NOT NULL,
    file_url TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS reminders (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id),
    pet_id TEXT NOT NULL REFERENCES pets(id),
    type TEXT NOT NULL DEFAULT 'تطعيم',
    title TEXT NOT NULL,
    due_date TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'مستحق',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS surgeries (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id),
    pet_id TEXT NOT NULL REFERENCES pets(id),
    visit_id TEXT REFERENCES visits(id),
    doctor_id TEXT REFERENCES users(id),
    procedure_name TEXT NOT NULL,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'مجدولة',
    risk_level TEXT NOT NULL DEFAULT 'متوسط',
    consent_signed INTEGER NOT NULL DEFAULT 0,
    fasting_confirmed INTEGER NOT NULL DEFAULT 0,
    preop_assessment TEXT,
    anesthesia_protocol TEXT,
    procedure_notes TEXT,
    recovery_notes TEXT,
    complications TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS anesthesia_logs (
    id TEXT PRIMARY KEY,
    surgery_id TEXT NOT NULL REFERENCES surgeries(id) ON DELETE CASCADE,
    recorded_at TEXT NOT NULL,
    heart_rate REAL,
    respiratory_rate REAL,
    spo2 REAL,
    temperature REAL,
    blood_pressure TEXT,
    anesthetic_depth TEXT,
    notes TEXT,
    recorded_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS cages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    cage_type TEXT NOT NULL DEFAULT 'تنويم',
    size TEXT NOT NULL DEFAULT 'متوسط',
    daily_rate REAL NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS admissions (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id),
    pet_id TEXT NOT NULL REFERENCES pets(id),
    doctor_id TEXT REFERENCES users(id),
    cage_id TEXT REFERENCES cages(id),
    admitted_at TEXT NOT NULL,
    expected_discharge_at TEXT,
    discharged_at TEXT,
    status TEXT NOT NULL DEFAULT 'منوّم',
    reason TEXT NOT NULL,
    diagnosis TEXT,
    diet_plan TEXT,
    daily_rate REAL NOT NULL DEFAULT 0,
    discharge_instructions TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS treatment_orders (
    id TEXT PRIMARY KEY,
    admission_id TEXT NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    medication TEXT NOT NULL,
    dosage TEXT NOT NULL,
    route TEXT,
    frequency TEXT NOT NULL,
    next_due_at TEXT,
    status TEXT NOT NULL DEFAULT 'نشط',
    instructions TEXT,
    ordered_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS nursing_logs (
    id TEXT PRIMARY KEY,
    admission_id TEXT NOT NULL REFERENCES admissions(id) ON DELETE CASCADE,
    log_type TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    temperature REAL,
    heart_rate REAL,
    respiratory_rate REAL,
    weight_kg REAL,
    medication TEXT,
    dosage TEXT,
    feeding TEXT,
    fluids TEXT,
    notes TEXT,
    recorded_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS lab_orders (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id),
    pet_id TEXT NOT NULL REFERENCES pets(id),
    visit_id TEXT REFERENCES visits(id),
    doctor_id TEXT REFERENCES users(id),
    test_name TEXT NOT NULL,
    specimen TEXT,
    priority TEXT NOT NULL DEFAULT 'عادي',
    status TEXT NOT NULL DEFAULT 'مطلوب',
    requested_at TEXT NOT NULL,
    collected_at TEXT,
    completed_at TEXT,
    result TEXT,
    reference_range TEXT,
    is_critical INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS imaging_orders (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id),
    pet_id TEXT NOT NULL REFERENCES pets(id),
    visit_id TEXT REFERENCES visits(id),
    doctor_id TEXT REFERENCES users(id),
    modality TEXT NOT NULL,
    body_region TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'عادي',
    status TEXT NOT NULL DEFAULT 'مطلوب',
    requested_at TEXT NOT NULL,
    completed_at TEXT,
    report TEXT,
    findings TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS grooming_bookings (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id),
    pet_id TEXT NOT NULL REFERENCES pets(id),
    service TEXT NOT NULL,
    booking_date TEXT NOT NULL,
    booking_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'مؤكد',
    groomer_name TEXT,
    price REAL NOT NULL DEFAULT 0,
    special_instructions TEXT,
    before_notes TEXT,
    after_notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS boarding_bookings (
    id TEXT PRIMARY KEY,
    client_id TEXT NOT NULL REFERENCES clients(id),
    pet_id TEXT NOT NULL REFERENCES pets(id),
    cage_id TEXT REFERENCES cages(id),
    check_in_at TEXT NOT NULL,
    check_out_at TEXT NOT NULL,
    actual_check_out_at TEXT,
    status TEXT NOT NULL DEFAULT 'محجوز',
    nightly_rate REAL NOT NULL DEFAULT 0,
    feeding_plan TEXT,
    medication_plan TEXT,
    emergency_contact TEXT,
    belongings TEXT,
    vaccination_verified INTEGER NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS boarding_logs (
    id TEXT PRIMARY KEY,
    boarding_id TEXT NOT NULL REFERENCES boarding_bookings(id) ON DELETE CASCADE,
    log_type TEXT NOT NULL,
    recorded_at TEXT NOT NULL,
    details TEXT NOT NULL,
    recorded_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS employee_shifts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    shift_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'مجدولة',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY,
    category TEXT NOT NULL DEFAULT 'مستلزمات عامة',
    title TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0,
    expense_date TEXT NOT NULL,
    payment_method TEXT NOT NULL DEFAULT 'نقداً',
    vendor TEXT,
    receipt_number TEXT,
    notes TEXT,
    created_by TEXT REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS clinic_settings (
    setting_key TEXT PRIMARY KEY,
    setting_value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function ensureColumn(table: string, column: string, definition: string): void {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((item) => item.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

ensureColumn('visits', 'appointment_id', 'TEXT REFERENCES appointments(id)');
ensureColumn('invoices', 'payment_method', 'TEXT DEFAULT \'نقدي\'');
ensureColumn('invoices', 'pet_id', 'TEXT REFERENCES pets(id)');
ensureColumn('visits', 'subjective', 'TEXT');
ensureColumn('visits', 'objective', 'TEXT');
ensureColumn('visits', 'assessment', 'TEXT');
ensureColumn('visits', 'heart_rate', 'REAL');
ensureColumn('visits', 'respiratory_rate', 'REAL');
ensureColumn('visits', 'body_condition_score', 'REAL');
ensureColumn('visits', 'pain_score', 'REAL');
ensureColumn('visits', 'follow_up_date', 'TEXT');

// Every list screen filters or joins on these columns. Without indexes SQLite
// full-scans, which becomes noticeable once a clinic has a few thousand visits.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_pets_client ON pets(client_id);
  CREATE INDEX IF NOT EXISTS idx_pets_microchip ON pets(microchip);
  CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date, appointment_time);
  CREATE INDEX IF NOT EXISTS idx_appointments_pet ON appointments(pet_id);
  CREATE INDEX IF NOT EXISTS idx_visits_pet ON visits(pet_id, visit_date DESC);
  CREATE INDEX IF NOT EXISTS idx_visits_client ON visits(client_id);
  CREATE INDEX IF NOT EXISTS idx_visits_status ON visits(status);
  CREATE INDEX IF NOT EXISTS idx_prescriptions_visit ON prescriptions(visit_id);
  CREATE INDEX IF NOT EXISTS idx_vaccinations_pet ON vaccinations(pet_id);
  CREATE INDEX IF NOT EXISTS idx_vaccinations_due ON vaccinations(next_due_date);
  CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
  CREATE INDEX IF NOT EXISTS idx_invoices_created ON invoices(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_invoices_visit ON invoices(visit_id);
  CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice_items(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payments(invoice_id);
  CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_surgeries_pet ON surgeries(pet_id);
  CREATE INDEX IF NOT EXISTS idx_surgeries_scheduled ON surgeries(scheduled_at DESC);
  CREATE INDEX IF NOT EXISTS idx_anesthesia_surgery ON anesthesia_logs(surgery_id, recorded_at);
  CREATE INDEX IF NOT EXISTS idx_admissions_pet ON admissions(pet_id);
  CREATE INDEX IF NOT EXISTS idx_admissions_cage ON admissions(cage_id, status);
  CREATE INDEX IF NOT EXISTS idx_treatment_orders_admission ON treatment_orders(admission_id);
  CREATE INDEX IF NOT EXISTS idx_nursing_logs_admission ON nursing_logs(admission_id, recorded_at DESC);
  CREATE INDEX IF NOT EXISTS idx_lab_orders_pet ON lab_orders(pet_id);
  CREATE INDEX IF NOT EXISTS idx_lab_orders_status ON lab_orders(status, requested_at DESC);
  CREATE INDEX IF NOT EXISTS idx_imaging_orders_pet ON imaging_orders(pet_id);
  CREATE INDEX IF NOT EXISTS idx_imaging_orders_status ON imaging_orders(status, requested_at DESC);
  CREATE INDEX IF NOT EXISTS idx_grooming_pet ON grooming_bookings(pet_id);
  CREATE INDEX IF NOT EXISTS idx_grooming_date ON grooming_bookings(booking_date DESC);
  CREATE INDEX IF NOT EXISTS idx_boarding_pet ON boarding_bookings(pet_id);
  CREATE INDEX IF NOT EXISTS idx_boarding_cage ON boarding_bookings(cage_id, status);
  CREATE INDEX IF NOT EXISTS idx_boarding_logs_booking ON boarding_logs(boarding_id, recorded_at DESC);
  CREATE INDEX IF NOT EXISTS idx_shifts_user ON employee_shifts(user_id, shift_date DESC);
  CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
`);

function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  if (!storedHash.startsWith('scrypt$')) {
    // Compatibility with the first local prototype; successful legacy logins
    // are upgraded by the API to a scrypt hash immediately.
    return Buffer.from(storedHash, 'base64').toString() === password;
  }
  const [, salt, expectedHex] = storedHash.split('$');
  if (!salt || !expectedHex) return false;
  const expected = Buffer.from(expectedHex, 'hex');
  const actual = scryptSync(password, salt, expected.length);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

const userCount = Number((db.prepare('SELECT COUNT(*) AS count FROM users').get() as { count: number }).count);
if (userCount === 0) {
  const insert = db.prepare('INSERT INTO users (id, name, username, password_hash, role) VALUES (?, ?, ?, ?, ?)');
  insert.run(id('usr'), 'مدير النظام', 'admin', hashPassword('admin123'), 'owner');
  insert.run(id('usr'), 'د. أحمد حسن', 'doctor', hashPassword('doctor123'), 'doctor');
  insert.run(id('usr'), 'موظف الاستقبال', 'reception', hashPassword('reception123'), 'reception');
}

const clientCount = Number((db.prepare('SELECT COUNT(*) AS count FROM clients').get() as { count: number }).count);
if (clientCount === 0) {
  const clientId = id('cli');
  const petId = id('pet');
  db.prepare('INSERT INTO clients (id, full_name, phone, whatsapp, address, notes) VALUES (?, ?, ?, ?, ?, ?)')
    .run(clientId, 'محمد أحمد', '01012345678', '01012345678', 'مدينة نصر، القاهرة', 'عميل مميز');
  db.prepare(`INSERT INTO pets (id, client_id, name, species, breed, sex, birth_date, color, weight_kg, microchip, neutered, allergies, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(petId, clientId, 'لوزة', 'قطة', 'شيرازي', 'أنثى', '2022-04-15', 'أبيض ورمادي', 4.2, '985141000123456', 1, 'لا توجد', 'نشط');
  db.prepare(`INSERT INTO appointments (id, client_id, pet_id, appointment_date, appointment_time, service, status, notes)
    VALUES (?, ?, ?, ?, '10:30', 'كشف عام', 'في الانتظار', 'متابعة التطعيمات')`).run(id('apt'), clientId, petId, localDateString());
}

const productCount = Number((db.prepare('SELECT COUNT(*) AS count FROM products').get() as { count: number }).count);
if (productCount === 0) {
  const insertProduct = db.prepare(`INSERT INTO products (id, sku, name, category, unit, sale_price, purchase_price, stock, min_stock, expiry_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  insertProduct.run(id('prd'), 'MED-0001', 'ميلبيماكس للقطط', 'أدوية', 'قرص', 45, 32, 24, 10, '2027-03-30');
  insertProduct.run(id('prd'), 'MED-0002', 'أمبول ريفوليوشن', 'وقاية', 'أمبول', 180, 135, 8, 10, '2026-11-20');
  insertProduct.run(id('prd'), 'SUP-0001', 'سرنجات 3 مل', 'مستهلكات', 'قطعة', 8, 4, 120, 30, null);
}

const cageCount = Number((db.prepare('SELECT COUNT(*) AS count FROM cages').get() as { count: number }).count);
if (cageCount === 0) {
  const insertCage = db.prepare('INSERT INTO cages (id, name, cage_type, size, daily_rate) VALUES (?, ?, ?, ?, ?)');
  insertCage.run(id('cage'), 'تنويم 1', 'تنويم', 'متوسط', 350);
  insertCage.run(id('cage'), 'تنويم 2', 'تنويم', 'كبير', 450);
  insertCage.run(id('cage'), 'فندق A1', 'فندق', 'متوسط', 300);
  insertCage.run(id('cage'), 'فندق A2', 'فندق', 'كبير', 400);
}

const settingsCount = Number((db.prepare('SELECT COUNT(*) AS count FROM clinic_settings').get() as { count: number }).count);
if (settingsCount === 0) {
  const insertSetting = db.prepare('INSERT INTO clinic_settings (setting_key, setting_value) VALUES (?, ?)');
  insertSetting.run('clinic_name', 'عيادة أليف البيطرية');
  insertSetting.run('phone', '01000000000');
  insertSetting.run('address', 'القاهرة، مصر');
  insertSetting.run('currency', 'ج.م');
  insertSetting.run('invoice_prefix', 'INV');
  insertSetting.run('tax_rate', '0');
}

export function makeId(prefix: string): string {
  return id(prefix);
}

export function recordAudit(userId: string | null, action: string, entity: string, entityId: string | null, details?: unknown): void {
  db.prepare('INSERT INTO audit_logs (id, user_id, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?, ?)')
    .run(makeId('audit'), userId, action, entity, entityId, details ? JSON.stringify(details) : null);
}

export function getDashboard() {
  const today = localDateString();
  const scalar = (sql: string, ...params: Array<string | number | null>) => Number((db.prepare(sql).get(...params) as { count: number }).count ?? 0);
  return {
    todayAppointments: scalar('SELECT COUNT(*) AS count FROM appointments WHERE appointment_date = ?', today),
    waitingPets: scalar("SELECT COUNT(*) AS count FROM appointments WHERE appointment_date = ? AND status IN ('في الانتظار', 'وصل')", today),
    openVisits: scalar("SELECT COUNT(*) AS count FROM visits WHERE status = 'مفتوحة'"),
    clients: scalar('SELECT COUNT(*) AS count FROM clients'),
    pets: scalar('SELECT COUNT(*) AS count FROM pets WHERE status = \'نشط\''),
    lowStock: scalar('SELECT COUNT(*) AS count FROM products WHERE active = 1 AND stock <= min_stock'),
    dueVaccinations: scalar("SELECT COUNT(*) AS count FROM vaccinations WHERE next_due_date IS NOT NULL AND next_due_date <= date(?, '+7 day')", today),
    outstandingBalance: Number((db.prepare('SELECT COALESCE(SUM(balance), 0) AS total FROM clients').get() as { total: number }).total ?? 0),
    todayRevenue: Number((db.prepare("SELECT COALESCE(SUM(paid), 0) AS total FROM invoices WHERE date(created_at, 'localtime') = ?").get(today) as { total: number }).total ?? 0),
    today,
  };
}
