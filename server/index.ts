import './env.ts';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { z } from 'zod';
import { clinicName, sessionHours } from './env.ts';
import { databasePath, db, getDashboard, hashPassword, localDateString, makeId, recordAudit, verifyPassword } from './db.ts';

const app = express();
const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '2mb' }));

type AuthRequest = Request & { user?: { id: string; role: string; name: string } };
const sessions = new Map<string, { id: string; role: string; name: string; expiresAt: number }>();

function auth(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  const session = token ? sessions.get(token) : undefined;
  if (!session || session.expiresAt < Date.now()) {
    res.status(401).json({ message: 'انتهت الجلسة أو بيانات الدخول غير صحيحة' });
    return;
  }
  req.user = session;
  next();
}

function role(...allowed: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowed.includes(req.user.role)) {
      res.status(403).json({ message: 'ليس لديك صلاحية لتنفيذ هذا الإجراء' });
      return;
    }
    next();
  };
}

function asyncRoute(handler: (req: AuthRequest, res: Response) => void) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    try { handler(req, res); } catch (error) { next(error); }
  };
}

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

class BusinessError extends Error {
  constructor(message: string, public readonly statusCode = 409) { super(message); }
}

app.get('/api/health', (_req, res) => res.json({ ok: true, clinic: clinicName }));

app.post('/api/auth/login', asyncRoute((req, res) => {
  const body = z.object({ username: z.string().min(1), password: z.string().min(1) }).parse(req.body);
  const user = db.prepare('SELECT id, name, username, password_hash, role FROM users WHERE username = ? AND active = 1').get(body.username) as { id: string; name: string; username: string; password_hash: string; role: string } | undefined;
  if (!user || !verifyPassword(body.password, user.password_hash)) {
    res.status(401).json({ message: 'اسم المستخدم أو كلمة المرور غير صحيحة' });
    return;
  }
  if (!user.password_hash.startsWith('scrypt$')) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(body.password), user.id);
  }
  const token = crypto.randomUUID();
  sessions.set(token, { id: user.id, name: user.name, role: user.role, expiresAt: Date.now() + Number(process.env.SESSION_HOURS ?? 12) * 60 * 60 * 1000 });
  recordAudit(user.id, 'تسجيل دخول', 'user', user.id);
  res.json({ token, user: { id: user.id, name: user.name, username: user.username, role: user.role } });
}));

app.post('/api/auth/logout', auth, asyncRoute((req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token) sessions.delete(token);
  res.status(204).send();
}));

app.get('/api/dashboard', auth, asyncRoute((_req, res) => res.json(getDashboard())));

app.get('/api/search', auth, asyncRoute((req, res) => {
  const query = String(req.query.q ?? '').trim();
  if (!query) { res.json({ clients: [], pets: [], visits: [], invoices: [], products: [] }); return; }
  const pattern = `%${query}%`;
  const clients = db.prepare(`SELECT id, full_name, phone, whatsapp, balance FROM clients WHERE full_name LIKE ? OR phone LIKE ? OR whatsapp LIKE ? LIMIT 6`).all(pattern, pattern, pattern);
  const pets = db.prepare(`SELECT p.id, p.name, p.species, p.breed, p.microchip, c.full_name AS client_name FROM pets p JOIN clients c ON c.id = p.client_id WHERE p.name LIKE ? OR p.microchip LIKE ? OR p.breed LIKE ? LIMIT 6`).all(pattern, pattern, pattern);
  const visits = db.prepare(`SELECT v.id, v.visit_date, v.chief_complaint, v.diagnosis, p.name AS pet_name, c.full_name AS client_name FROM visits v JOIN pets p ON p.id = v.pet_id JOIN clients c ON c.id = v.client_id WHERE v.diagnosis LIKE ? OR v.chief_complaint LIKE ? OR p.name LIKE ? LIMIT 6`).all(pattern, pattern, pattern);
  const invoices = db.prepare(`SELECT i.id, i.invoice_number, i.total, i.status, c.full_name AS client_name FROM invoices i JOIN clients c ON c.id = i.client_id WHERE i.invoice_number LIKE ? OR c.full_name LIKE ? LIMIT 6`).all(pattern, pattern);
  const products = db.prepare(`SELECT id, sku, name, category, stock, unit, sale_price FROM products WHERE active = 1 AND (name LIKE ? OR sku LIKE ? OR category LIKE ?) LIMIT 6`).all(pattern, pattern, pattern);
  res.json({ clients, pets, visits, invoices, products });
}));

app.get('/api/users/me', auth, asyncRoute((req, res) => res.json(req.user)));

app.get('/api/clients', auth, asyncRoute((req, res) => {
  const search = String(req.query.search ?? '').trim();
  const clients = db.prepare(`SELECT c.*, COUNT(p.id) AS pet_count FROM clients c LEFT JOIN pets p ON p.client_id = c.id
    WHERE (? = '' OR c.full_name LIKE ? OR c.phone LIKE ? OR c.whatsapp LIKE ? OR c.address LIKE ? OR c.notes LIKE ?)
    GROUP BY c.id ORDER BY c.updated_at DESC`).all(search, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  res.json(clients);
}));

app.get('/api/clients/:id', auth, asyncRoute((req, res) => {
  const clientId = param(req.params.id);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!client) { res.status(404).json({ message: 'العميل غير موجود' }); return; }
  const pets = db.prepare('SELECT * FROM pets WHERE client_id = ? ORDER BY name').all(clientId);
  res.json({ client, pets });
}));

app.get('/api/clients/:id/full', auth, asyncRoute((req, res) => {
  const clientId = param(req.params.id);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId);
  if (!client) { res.status(404).json({ message: 'العميل غير موجود' }); return; }
  const pets = db.prepare('SELECT * FROM pets WHERE client_id = ? ORDER BY name').all(clientId);
  const visits = db.prepare(`SELECT v.*, p.name AS pet_name, p.species, u.name AS doctor_name FROM visits v JOIN pets p ON p.id = v.pet_id LEFT JOIN users u ON u.id = v.doctor_id WHERE v.client_id = ? ORDER BY v.visit_date DESC`).all(clientId);
  const vaccinations = db.prepare(`SELECT v.*, p.name AS pet_name, p.species, u.name AS doctor_name FROM vaccinations v JOIN pets p ON p.id = v.pet_id LEFT JOIN users u ON u.id = v.doctor_id WHERE p.client_id = ? ORDER BY v.administered_date DESC`).all(clientId);
  const invoices = db.prepare(`SELECT i.*, COUNT(ii.id) AS item_count FROM invoices i LEFT JOIN invoice_items ii ON ii.invoice_id = i.id WHERE i.client_id = ? GROUP BY i.id ORDER BY i.created_at DESC`).all(clientId);
  const appointments = db.prepare(`SELECT a.*, p.name AS pet_name, p.species, u.name AS doctor_name FROM appointments a JOIN pets p ON p.id = a.pet_id LEFT JOIN users u ON u.id = a.doctor_id WHERE a.client_id = ? ORDER BY a.appointment_date DESC, a.appointment_time DESC`).all(clientId);
  res.json({ client, pets, visits, vaccinations, invoices, appointments });
}));

const clientSchema = z.object({
  fullName: z.string().trim().min(2, 'اسم العميل مطلوب'),
  phone: z.string().trim().min(7, 'رقم الهاتف غير صحيح'),
  whatsapp: z.string().trim().optional().default(''),
  email: z.string().trim().optional().default(''),
  address: z.string().trim().optional().default(''),
  notes: z.string().trim().optional().default(''),
});

app.post('/api/clients', auth, role('owner', 'manager', 'reception', 'doctor'), asyncRoute((req, res) => {
  const body = clientSchema.parse(req.body);
  const clientId = makeId('cli');
  db.prepare('INSERT INTO clients (id, full_name, phone, whatsapp, email, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(clientId, body.fullName, body.phone, body.whatsapp, body.email, body.address, body.notes);
  recordAudit(req.user?.id ?? null, 'إنشاء', 'client', clientId, body);
  res.status(201).json(db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId));
}));

app.patch('/api/clients/:id', auth, role('owner', 'manager', 'reception', 'doctor'), asyncRoute((req, res) => {
  const body = clientSchema.partial().parse(req.body);
  const clientId = param(req.params.id);
  const current = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as Record<string, string | number | null> | undefined;
  if (!current) { res.status(404).json({ message: 'العميل غير موجود' }); return; }
  const fullName = body.fullName ?? String(current.full_name ?? '');
  const phone = body.phone ?? String(current.phone ?? '');
  const whatsapp = body.whatsapp ?? current.whatsapp;
  const email = body.email ?? current.email;
  const address = body.address ?? current.address;
  const notes = body.notes ?? current.notes;
  db.prepare(`UPDATE clients SET full_name = ?, phone = ?, whatsapp = ?, email = ?, address = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(fullName, phone, whatsapp, email, address, notes, clientId);
  recordAudit(req.user?.id ?? null, 'تعديل', 'client', clientId, body);
  res.json(db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId));
}));

app.delete('/api/clients/:id', auth, role('owner', 'manager'), asyncRoute((req, res) => {
  const clientId = param(req.params.id);
  const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(clientId) as Record<string, any> | undefined;
  if (!client) { res.status(404).json({ message: 'العميل غير موجود' }); return; }
  const petCount = (db.prepare('SELECT COUNT(*) as cnt FROM pets WHERE client_id = ?').get(clientId) as any).cnt;
  if (petCount > 0) {
    res.status(400).json({ message: `لا يمكن حذف العميل (${client.full_name}) لأن لديه ${petCount} حيوانات مسجلة. قم بحذف الحيوانات أولاً.` });
    return;
  }
  db.prepare('DELETE FROM clients WHERE id = ?').run(clientId);
  recordAudit(req.user?.id ?? null, 'حذف', 'client', clientId, { name: client.full_name });
  res.json({ message: 'تم حذف العميل بنجاح' });
}));

const petSchema = z.object({
  clientId: z.string().min(1), name: z.string().trim().min(1, 'اسم الحيوان مطلوب'), species: z.enum(['قطة', 'كلب']),
  breed: z.string().trim().optional().default(''), sex: z.string().trim().optional().default(''), birthDate: z.string().optional().default(''),
  color: z.string().trim().optional().default(''), weightKg: z.coerce.number().nonnegative().optional(), microchip: z.string().trim().optional().default(''),
  neutered: z.boolean().optional().default(false), allergies: z.string().trim().optional().default(''), chronicConditions: z.string().trim().optional().default(''), notes: z.string().trim().optional().default(''),
});

app.get('/api/pets', auth, asyncRoute((req, res) => {
  const search = String(req.query.search ?? '').trim();
  const pets = db.prepare(`SELECT p.*, c.full_name AS client_name, c.phone AS client_phone FROM pets p JOIN clients c ON c.id = p.client_id
    WHERE (? = '' OR p.name LIKE ? OR p.microchip LIKE ? OR c.full_name LIKE ? OR c.phone LIKE ?) ORDER BY p.updated_at DESC`)
    .all(search, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
  res.json(pets);
}));

app.get('/api/pets/:id/full', auth, asyncRoute((req, res) => {
  const petId = param(req.params.id);
  const pet = db.prepare(`SELECT p.*, c.full_name AS client_name, c.phone AS client_phone, c.whatsapp AS client_whatsapp FROM pets p JOIN clients c ON c.id = p.client_id WHERE p.id = ?`).get(petId);
  if (!pet) { res.status(404).json({ message: 'الحيوان غير موجود' }); return; }
  const visits = db.prepare(`SELECT v.*, u.name AS doctor_name FROM visits v LEFT JOIN users u ON u.id = v.doctor_id WHERE v.pet_id = ? ORDER BY v.visit_date DESC`).all(petId);
  const vaccinations = db.prepare(`SELECT v.*, u.name AS doctor_name FROM vaccinations v LEFT JOIN users u ON u.id = v.doctor_id WHERE v.pet_id = ? ORDER BY v.administered_date DESC`).all(petId);
  const surgeries = db.prepare(`SELECT s.*, u.name AS doctor_name FROM surgeries s LEFT JOIN users u ON u.id = s.doctor_id WHERE s.pet_id = ? ORDER BY s.scheduled_at DESC`).all(petId);
  const admissions = db.prepare(`SELECT a.*, cg.name AS cage_name FROM admissions a LEFT JOIN cages cg ON cg.id = a.cage_id WHERE a.pet_id = ? ORDER BY a.admitted_at DESC`).all(petId);
  const grooming = db.prepare(`SELECT * FROM grooming_bookings WHERE pet_id = ? ORDER BY booking_date DESC`).all(petId);
  const boarding = db.prepare(`SELECT b.*, cg.name AS cage_name FROM boarding_bookings b LEFT JOIN cages cg ON cg.id = b.cage_id WHERE b.pet_id = ? ORDER BY b.check_in_at DESC`).all(petId);
  const labTests = db.prepare(`SELECT l.*, u.name AS doctor_name FROM lab_tests l LEFT JOIN users u ON u.id = l.doctor_id WHERE l.pet_id = ? ORDER BY l.created_at DESC`).all(petId);
  const attachments = db.prepare(`SELECT * FROM medical_attachments WHERE pet_id = ? ORDER BY created_at DESC`).all(petId);
  const reminders = db.prepare(`SELECT * FROM reminders WHERE pet_id = ? ORDER BY due_date DESC`).all(petId);
  res.json({ pet, visits, vaccinations, surgeries, admissions, grooming, boarding, labTests, attachments, reminders });
}));

app.post('/api/lab-tests', auth, role('owner', 'manager', 'doctor'), asyncRoute((req, res) => {
  const body = z.object({
    petId: z.string().min(1),
    visitId: z.string().optional().default(''),
    testName: z.string().trim().min(2, 'اسم التحليل مطلوب'),
    testType: z.string().trim().optional().default('تحليل عام'),
    resultsJson: z.string().optional().default('{}'),
    notes: z.string().trim().optional().default(''),
  }).parse(req.body);
  const labId = makeId('lab');
  db.prepare(`INSERT INTO lab_tests (id, pet_id, visit_id, doctor_id, test_name, test_type, results_json, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(labId, body.petId, body.visitId || null, req.user?.id ?? null, body.testName, body.testType, body.resultsJson, body.notes);
  recordAudit(req.user?.id ?? null, 'تسجيل تحليل', 'lab_test', labId, body);
  res.status(201).json(db.prepare('SELECT * FROM lab_tests WHERE id = ?').get(labId));
}));

app.post('/api/attachments', auth, role('owner', 'manager', 'doctor', 'reception'), asyncRoute((req, res) => {
  const body = z.object({
    petId: z.string().min(1),
    visitId: z.string().optional().default(''),
    category: z.string().trim().optional().default('أشعة سينية'),
    title: z.string().trim().min(2, 'عنوان المرفق مطلوب'),
    fileUrl: z.string().trim().min(2, 'مسار أو رابط الملف مطلوب'),
    notes: z.string().trim().optional().default(''),
  }).parse(req.body);
  const attId = makeId('att');
  db.prepare(`INSERT INTO medical_attachments (id, pet_id, visit_id, category, title, file_url, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(attId, body.petId, body.visitId || null, body.category, body.title, body.fileUrl, body.notes);
  recordAudit(req.user?.id ?? null, 'إضافة مرفق/أشعة', 'medical_attachment', attId, body);
  res.status(201).json(db.prepare('SELECT * FROM medical_attachments WHERE id = ?').get(attId));
}));

app.delete('/api/lab-tests/:id', auth, role('owner', 'manager', 'doctor'), asyncRoute((req, res) => {
  const labId = param(req.params.id);
  db.prepare('DELETE FROM lab_tests WHERE id = ?').run(labId);
  recordAudit(req.user?.id ?? null, 'حذف تحليل', 'lab_test', labId, {});
  res.json({ message: 'تم حذف التحليل بنجاح' });
}));

app.delete('/api/attachments/:id', auth, role('owner', 'manager', 'doctor', 'reception'), asyncRoute((req, res) => {
  const attId = param(req.params.id);
  db.prepare('DELETE FROM medical_attachments WHERE id = ?').run(attId);
  recordAudit(req.user?.id ?? null, 'حذف مرفق/أشعة', 'medical_attachment', attId, {});
  res.json({ message: 'تم حذف المرفق بنجاح' });
}));

app.post('/api/surgeries', auth, role('owner', 'manager', 'doctor'), asyncRoute((req, res) => {
  const body = z.object({
    clientId: z.string().min(1),
    petId: z.string().min(1),
    visitId: z.string().optional().default(''),
    procedureName: z.string().trim().min(2, 'اسم الجراحة مطلوب'),
    scheduledAt: z.string().min(8),
    riskLevel: z.string().optional().default('متوسط'),
    status: z.string().optional().default('مجدولة'),
    preopAssessment: z.string().optional().default(''),
    anesthesiaProtocol: z.string().optional().default(''),
    procedureNotes: z.string().optional().default(''),
    recoveryNotes: z.string().optional().default(''),
  }).parse(req.body);
  const surgId = makeId('surg');
  db.prepare(`INSERT INTO surgeries (id, client_id, pet_id, visit_id, doctor_id, procedure_name, scheduled_at, risk_level, status, preop_assessment, anesthesia_protocol, procedure_notes, recovery_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      surgId, body.clientId, body.petId, body.visitId || null, req.user?.id ?? null,
      body.procedureName, body.scheduledAt, body.riskLevel, body.status,
      body.preopAssessment, body.anesthesiaProtocol, body.procedureNotes, body.recoveryNotes
    );
  recordAudit(req.user?.id ?? null, 'تسجيل جراحة', 'surgery', surgId, body);
  res.status(201).json(db.prepare('SELECT * FROM surgeries WHERE id = ?').get(surgId));
}));

app.patch('/api/surgeries/:id', auth, role('owner', 'manager', 'doctor'), asyncRoute((req, res) => {
  const surgId = param(req.params.id);
  const current = db.prepare('SELECT * FROM surgeries WHERE id = ?').get(surgId) as Record<string, any> | undefined;
  if (!current) { res.status(404).json({ message: 'الجراحة غير موجودة' }); return; }
  const body = req.body || {};
  const procedureName = body.procedureName ?? current.procedure_name;
  const scheduledAt = body.scheduledAt ?? current.scheduled_at;
  const status = body.status ?? current.status;
  const riskLevel = body.riskLevel ?? current.risk_level;
  const preopAssessment = body.preopAssessment ?? current.preop_assessment;
  const anesthesiaProtocol = body.anesthesiaProtocol ?? current.anesthesia_protocol;
  const procedureNotes = body.procedureNotes ?? current.procedure_notes;
  const recoveryNotes = body.recoveryNotes ?? current.recovery_notes;
  const complications = body.complications ?? current.complications;
  db.prepare(`UPDATE surgeries SET procedure_name = ?, scheduled_at = ?, status = ?, risk_level = ?, preop_assessment = ?, anesthesia_protocol = ?, procedure_notes = ?, recovery_notes = ?, complications = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(procedureName, scheduledAt, status, riskLevel, preopAssessment, anesthesiaProtocol, procedureNotes, recoveryNotes, complications, surgId);
  recordAudit(req.user?.id ?? null, 'تعديل جراحة', 'surgery', surgId, body);
  res.json(db.prepare('SELECT * FROM surgeries WHERE id = ?').get(surgId));
}));

app.delete('/api/surgeries/:id', auth, role('owner', 'manager', 'doctor'), asyncRoute((req, res) => {
  const surgId = param(req.params.id);
  db.prepare('DELETE FROM surgeries WHERE id = ?').run(surgId);
  recordAudit(req.user?.id ?? null, 'حذف جراحة', 'surgery', surgId, {});
  res.json({ message: 'تم حذف عملية الجراحة بنجاح' });
}));

app.post('/api/grooming', auth, role('owner', 'manager', 'reception', 'doctor'), asyncRoute((req, res) => {
  const body = z.object({
    clientId: z.string().min(1),
    petId: z.string().min(1),
    service: z.string().trim().min(2, 'نوع الخدمة مطلوب'),
    bookingDate: z.string().min(8),
    bookingTime: z.string().optional().default('12:00'),
    status: z.string().optional().default('مؤكد'),
    groomerName: z.string().optional().default(''),
    price: z.number().optional().default(0),
    specialInstructions: z.string().optional().default(''),
  }).parse(req.body);
  const groomId = makeId('grm');
  db.prepare(`INSERT INTO grooming_bookings (id, client_id, pet_id, service, booking_date, booking_time, status, groomer_name, price, special_instructions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      groomId, body.clientId, body.petId, body.service, body.bookingDate, body.bookingTime,
      body.status, body.groomerName, body.price, body.specialInstructions
    );
  recordAudit(req.user?.id ?? null, 'حجز grooming', 'grooming_booking', groomId, body);
  res.status(201).json(db.prepare('SELECT * FROM grooming_bookings WHERE id = ?').get(groomId));
}));

app.patch('/api/grooming/:id', auth, role('owner', 'manager', 'reception', 'doctor'), asyncRoute((req, res) => {
  const groomId = param(req.params.id);
  const current = db.prepare('SELECT * FROM grooming_bookings WHERE id = ?').get(groomId) as Record<string, any> | undefined;
  if (!current) { res.status(404).json({ message: 'الحجز غير موجود' }); return; }
  const body = req.body || {};
  const service = body.service ?? current.service;
  const bookingDate = body.bookingDate ?? current.booking_date;
  const bookingTime = body.bookingTime ?? current.booking_time;
  const status = body.status ?? current.status;
  const groomerName = body.groomerName ?? current.groomer_name;
  const price = body.price !== undefined ? body.price : current.price;
  const specialInstructions = body.specialInstructions ?? current.special_instructions;
  db.prepare(`UPDATE grooming_bookings SET service = ?, booking_date = ?, booking_time = ?, status = ?, groomer_name = ?, price = ?, special_instructions = ? WHERE id = ?`)
    .run(service, bookingDate, bookingTime, status, groomerName, price, specialInstructions, groomId);
  recordAudit(req.user?.id ?? null, 'تعديل grooming', 'grooming_booking', groomId, body);
  res.json(db.prepare('SELECT * FROM grooming_bookings WHERE id = ?').get(groomId));
}));

app.delete('/api/grooming/:id', auth, role('owner', 'manager', 'reception'), asyncRoute((req, res) => {
  const groomId = param(req.params.id);
  db.prepare('DELETE FROM grooming_bookings WHERE id = ?').run(groomId);
  recordAudit(req.user?.id ?? null, 'حذف grooming', 'grooming_booking', groomId, {});
  res.json({ message: 'تم حذف حجز الجرومينج بنجاح' });
}));

app.get('/api/reminders/due', auth, asyncRoute((req, res) => {
  const reminders = db.prepare(`SELECT r.*, c.full_name AS client_name, c.phone AS client_phone, c.whatsapp AS client_whatsapp, p.name AS pet_name
    FROM reminders r JOIN clients c ON c.id = r.client_id JOIN pets p ON p.id = r.pet_id
    WHERE r.status != 'مكتمل' ORDER BY r.due_date ASC`).all();
  res.json(reminders);
}));

app.post('/api/reminders', auth, role('owner', 'manager', 'doctor', 'reception'), asyncRoute((req, res) => {
  const body = z.object({
    clientId: z.string().min(1),
    petId: z.string().min(1),
    type: z.string().trim().optional().default('تطعيم'),
    title: z.string().trim().min(2, 'عنوان التذكير مطلوب'),
    dueDate: z.string().min(8),
    notes: z.string().trim().optional().default(''),
  }).parse(req.body);
  const remId = makeId('rem');
  db.prepare(`INSERT INTO reminders (id, client_id, pet_id, type, title, due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(remId, body.clientId, body.petId, body.type, body.title, body.dueDate, body.notes);
  recordAudit(req.user?.id ?? null, 'إنشاء تذكير', 'reminder', remId, body);
  res.status(201).json(db.prepare('SELECT * FROM reminders WHERE id = ?').get(remId));
}));

app.patch('/api/reminders/:id/status', auth, role('owner', 'manager', 'reception', 'doctor'), asyncRoute((req, res) => {
  const remId = param(req.params.id);
  const body = z.object({ status: z.enum(['مستحق', 'تم التذكير', 'مكتمل']) }).parse(req.body);
  db.prepare('UPDATE reminders SET status = ? WHERE id = ?').run(body.status, remId);
  res.json({ ok: true });
}));

app.post('/api/pets', auth, role('owner', 'manager', 'reception', 'doctor'), asyncRoute((req, res) => {
  const body = petSchema.parse(req.body);
  const petId = makeId('pet');
  const client = db.prepare('SELECT id FROM clients WHERE id = ?').get(body.clientId);
  if (!client) { res.status(400).json({ message: 'العميل المرتبط غير موجود' }); return; }
  db.prepare(`INSERT INTO pets (id, client_id, name, species, breed, sex, birth_date, color, weight_kg, microchip, neutered, allergies, chronic_conditions, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(petId, body.clientId, body.name, body.species, body.breed, body.sex, body.birthDate, body.color, body.weightKg ?? null, body.microchip, body.neutered ? 1 : 0, body.allergies, body.chronicConditions, body.notes);
  recordAudit(req.user?.id ?? null, 'إنشاء', 'pet', petId, body);
  res.status(201).json(db.prepare('SELECT * FROM pets WHERE id = ?').get(petId));
}));

app.patch('/api/pets/:id', auth, role('owner', 'manager', 'reception', 'doctor'), asyncRoute((req, res) => {
  const body = petSchema.partial().parse(req.body);
  const petId = param(req.params.id);
  const current = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId) as Record<string, string | number | null> | undefined;
  if (!current) { res.status(404).json({ message: 'الحيوان غير موجود' }); return; }
  const name = body.name ?? String(current.name ?? '');
  const species = body.species ?? String(current.species ?? 'قطة');
  const breed = body.breed ?? current.breed;
  const sex = body.sex ?? current.sex;
  const birthDate = body.birthDate ?? current.birth_date;
  const color = body.color ?? current.color;
  const weightKg = body.weightKg !== undefined ? body.weightKg : current.weight_kg;
  const microchip = body.microchip ?? current.microchip;
  const neutered = body.neutered !== undefined ? (body.neutered ? 1 : 0) : current.neutered;
  const allergies = body.allergies ?? current.allergies;
  const chronicConditions = body.chronicConditions ?? current.chronic_conditions;
  const notes = body.notes ?? current.notes;
  db.prepare(`UPDATE pets SET name = ?, species = ?, breed = ?, sex = ?, birth_date = ?, color = ?, weight_kg = ?, microchip = ?, neutered = ?, allergies = ?, chronic_conditions = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .run(name, species, breed, sex, birthDate, color, weightKg, microchip, neutered, allergies, chronicConditions, notes, petId);
  recordAudit(req.user?.id ?? null, 'تعديل', 'pet', petId, body);
  res.json(db.prepare('SELECT * FROM pets WHERE id = ?').get(petId));
}));

app.delete('/api/pets/:id', auth, role('owner', 'manager'), asyncRoute((req, res) => {
  const petId = param(req.params.id);
  const pet = db.prepare('SELECT * FROM pets WHERE id = ?').get(petId) as Record<string, any> | undefined;
  if (!pet) { res.status(404).json({ message: 'الحيوان غير موجود' }); return; }
  db.prepare('DELETE FROM pets WHERE id = ?').run(petId);
  recordAudit(req.user?.id ?? null, 'حذف', 'pet', petId, { name: pet.name });
  res.json({ message: 'تم حذف الحيوان بنجاح' });
}));

app.get('/api/appointments', auth, asyncRoute((req, res) => {
  const date = String(req.query.date ?? localDateString());
  const appointments = db.prepare(`SELECT a.*, c.full_name AS client_name, c.phone AS client_phone, p.name AS pet_name, p.species, u.name AS doctor_name
    FROM appointments a JOIN clients c ON c.id = a.client_id JOIN pets p ON p.id = a.pet_id LEFT JOIN users u ON u.id = a.doctor_id
    WHERE a.appointment_date = ? ORDER BY a.appointment_time`).all(date);
  res.json(appointments);
}));

const appointmentSchema = z.object({
  clientId: z.string().min(1), petId: z.string().min(1), appointmentDate: z.string().min(8), appointmentTime: z.string().min(4),
  service: z.string().trim().min(2), doctorId: z.string().optional().default(''), notes: z.string().trim().optional().default(''),
});

app.post('/api/appointments', auth, role('owner', 'manager', 'reception'), asyncRoute((req, res) => {
  const body = appointmentSchema.parse(req.body);
  const appointmentId = makeId('apt');
  const relation = db.prepare('SELECT p.id FROM pets p WHERE p.id = ? AND p.client_id = ?').get(body.petId, body.clientId);
  if (!relation) { res.status(400).json({ message: 'الحيوان لا يتبع العميل المحدد' }); return; }
  db.prepare(`INSERT INTO appointments (id, client_id, pet_id, doctor_id, appointment_date, appointment_time, service, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'مؤكد', ?)`).run(appointmentId, body.clientId, body.petId, body.doctorId || null, body.appointmentDate, body.appointmentTime, body.service, body.notes);
  recordAudit(req.user?.id ?? null, 'إنشاء', 'appointment', appointmentId, body);
  res.status(201).json(db.prepare('SELECT * FROM appointments WHERE id = ?').get(appointmentId));
}));

const visitSchema = z.object({
  clientId: z.string().min(1), petId: z.string().min(1), appointmentId: z.string().optional().default(''),
  visitDate: z.string().optional().default(localDateString()), chiefComplaint: z.string().trim().min(2, 'سبب الزيارة مطلوب'),
  subjective: z.string().trim().optional().default(''), objective: z.string().trim().optional().default(''),
  assessment: z.string().trim().optional().default(''), diagnosis: z.string().trim().optional().default(''),
  treatmentPlan: z.string().trim().optional().default(''), notes: z.string().trim().optional().default(''),
  temperature: z.coerce.number().optional(), weightKg: z.coerce.number().positive().optional(), heartRate: z.coerce.number().positive().optional(),
  respiratoryRate: z.coerce.number().positive().optional(), bodyConditionScore: z.coerce.number().min(1).max(9).optional(),
  painScore: z.coerce.number().min(0).max(10).optional(), followUpDate: z.string().optional().default(''),
  status: z.enum(['مفتوحة', 'مكتملة']).optional().default('مفتوحة'),
  prescriptions: z.array(z.object({ medication: z.string().min(1), dosage: z.string().min(1), frequency: z.string().optional().default(''), duration: z.string().optional().default(''), route: z.string().optional().default(''), instructions: z.string().optional().default('') })).optional().default([]),
});

app.get('/api/visits', auth, asyncRoute((req, res) => {
  const search = String(req.query.search ?? '').trim();
  const visits = db.prepare(`SELECT v.*, p.name AS pet_name, p.species, p.breed, c.full_name AS client_name, c.phone AS client_phone, u.name AS doctor_name
    FROM visits v JOIN pets p ON p.id = v.pet_id JOIN clients c ON c.id = v.client_id LEFT JOIN users u ON u.id = v.doctor_id
    WHERE (? = '' OR p.name LIKE ? OR c.full_name LIKE ? OR v.diagnosis LIKE ?) ORDER BY v.visit_date DESC, v.created_at DESC`).all(search, `%${search}%`, `%${search}%`, `%${search}%`);
  res.json(visits);
}));

app.get('/api/visits/:id', auth, asyncRoute((req, res) => {
  const visitId = param(req.params.id);
  const visit = db.prepare(`SELECT v.*, p.name AS pet_name, p.species, c.full_name AS client_name, u.name AS doctor_name FROM visits v JOIN pets p ON p.id = v.pet_id JOIN clients c ON c.id = v.client_id LEFT JOIN users u ON u.id = v.doctor_id WHERE v.id = ?`).get(visitId);
  if (!visit) { res.status(404).json({ message: 'الزيارة غير موجودة' }); return; }
  const prescriptions = db.prepare('SELECT * FROM prescriptions WHERE visit_id = ? ORDER BY created_at').all(visitId);
  const vaccinations = db.prepare('SELECT * FROM vaccinations WHERE visit_id = ? ORDER BY administered_date DESC').all(visitId);
  res.json({ visit, prescriptions, vaccinations });
}));

app.post('/api/visits', auth, role('owner', 'manager', 'doctor'), asyncRoute((req, res) => {
  const body = visitSchema.parse(req.body);
  const relation = db.prepare('SELECT id FROM pets WHERE id = ? AND client_id = ?').get(body.petId, body.clientId);
  if (!relation) { res.status(400).json({ message: 'بيانات العميل والحيوان غير مترابطة' }); return; }
  const visitId = makeId('vis');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO visits (id, client_id, pet_id, doctor_id, appointment_id, visit_date, status, chief_complaint, subjective, objective, assessment, diagnosis, treatment_plan, temperature, weight_kg, heart_rate, respiratory_rate, body_condition_score, pain_score, follow_up_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(visitId, body.clientId, body.petId, req.user?.id ?? null, body.appointmentId || null, body.visitDate, body.status, body.chiefComplaint, body.subjective, body.objective, body.assessment, body.diagnosis, body.treatmentPlan, body.temperature ?? null, body.weightKg ?? null, body.heartRate ?? null, body.respiratoryRate ?? null, body.bodyConditionScore ?? null, body.painScore ?? null, body.followUpDate || null, body.notes);
    const prescriptionStatement = db.prepare('INSERT INTO prescriptions (id, visit_id, medication, dosage, frequency, duration, route, instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const item of body.prescriptions) prescriptionStatement.run(makeId('rx'), visitId, item.medication, item.dosage, item.frequency, item.duration, item.route, item.instructions);
    if (body.weightKg) db.prepare('UPDATE pets SET weight_kg = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(body.weightKg, body.petId);
    if (body.appointmentId) db.prepare("UPDATE appointments SET status = 'مكتمل' WHERE id = ?").run(body.appointmentId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  recordAudit(req.user?.id ?? null, 'إنشاء', 'visit', visitId, { petId: body.petId, status: body.status });
  res.status(201).json(db.prepare('SELECT * FROM visits WHERE id = ?').get(visitId));
}));

const vaccinationSchema = z.object({
  petId: z.string().min(1), visitId: z.string().optional().default(''), vaccineName: z.string().trim().min(2),
  dose: z.string().trim().optional().default(''), batchNumber: z.string().trim().optional().default(''), expiryDate: z.string().optional().default(''),
  administeredDate: z.string().default(localDateString()), nextDueDate: z.string().optional().default(''), notes: z.string().optional().default(''),
});

app.get('/api/vaccinations', auth, asyncRoute((_req, res) => {
  res.json(db.prepare(`SELECT v.*, p.name AS pet_name, p.species, p.breed, c.full_name AS client_name, c.phone AS client_phone, u.name AS doctor_name
    FROM vaccinations v JOIN pets p ON p.id = v.pet_id JOIN clients c ON c.id = p.client_id LEFT JOIN users u ON u.id = v.doctor_id ORDER BY v.administered_date DESC`).all());
}));

app.get('/api/vaccinations/due', auth, asyncRoute((_req, res) => {
  res.json(db.prepare(`SELECT v.*, p.name AS pet_name, p.species, c.full_name AS client_name, c.phone AS client_phone FROM vaccinations v JOIN pets p ON p.id = v.pet_id JOIN clients c ON c.id = p.client_id WHERE v.next_due_date IS NOT NULL AND v.next_due_date <= date(?, '+30 day') ORDER BY v.next_due_date`).all(localDateString()));
}));

app.post('/api/vaccinations', auth, role('owner', 'manager', 'doctor', 'assistant'), asyncRoute((req, res) => {
  const body = vaccinationSchema.parse(req.body); const vaccinationId = makeId('vac');
  if (!db.prepare('SELECT id FROM pets WHERE id = ?').get(body.petId)) { res.status(400).json({ message: 'الحيوان غير موجود' }); return; }
  db.prepare(`INSERT INTO vaccinations (id, pet_id, visit_id, doctor_id, vaccine_name, dose, batch_number, expiry_date, administered_date, next_due_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(vaccinationId, body.petId, body.visitId || null, req.user?.id ?? null, body.vaccineName, body.dose, body.batchNumber, body.expiryDate || null, body.administeredDate, body.nextDueDate || null, body.notes);
  recordAudit(req.user?.id ?? null, 'إعطاء تطعيم', 'vaccination', vaccinationId, { petId: body.petId, vaccine: body.vaccineName });
  res.status(201).json(db.prepare('SELECT * FROM vaccinations WHERE id = ?').get(vaccinationId));
}));

const invoiceSchema = z.object({
  clientId: z.string().min(1), petId: z.string().optional().default(''), visitId: z.string().optional().default(''), discount: z.coerce.number().nonnegative().default(0), tax: z.coerce.number().nonnegative().default(0),
  paid: z.coerce.number().nonnegative().default(0), paymentMethod: z.string().optional().default('نقدي'),
  items: z.array(z.object({ productId: z.string().optional().default(''), itemType: z.enum(['خدمة', 'دواء', 'مستهلك']).default('خدمة'), description: z.string().min(1), quantity: z.coerce.number().positive(), unitPrice: z.coerce.number().nonnegative() })).min(1),
});

app.get('/api/invoices', auth, asyncRoute((_req, res) => {
  res.json(db.prepare(`SELECT i.*, c.full_name AS client_name, c.phone AS client_phone, p.name AS pet_name, COUNT(ii.id) AS item_count FROM invoices i LEFT JOIN clients c ON c.id = i.client_id LEFT JOIN pets p ON p.id = i.pet_id LEFT JOIN invoice_items ii ON ii.invoice_id = i.id GROUP BY i.id ORDER BY i.created_at DESC`).all());
}));

app.get('/api/expenses', auth, asyncRoute((_req, res) => {
  res.json(db.prepare(`SELECT e.*, u.name AS created_by_name FROM expenses e LEFT JOIN users u ON u.id = e.created_by ORDER BY e.expense_date DESC, e.created_at DESC`).all());
}));

app.post('/api/expenses', auth, role('owner', 'manager', 'accountant', 'reception'), asyncRoute((req, res) => {
  const body = z.object({
    category: z.string().trim().optional().default('مستلزمات عامة'),
    title: z.string().trim().min(2, 'بيان المصروف مطلوب'),
    amount: z.coerce.number().positive('المبلغ يجب أن يكون أكبر من صفر'),
    expenseDate: z.string().min(8),
    paymentMethod: z.string().optional().default('نقداً'),
    vendor: z.string().optional().default(''),
    receiptNumber: z.string().optional().default(''),
    notes: z.string().optional().default(''),
  }).parse(req.body);
  const expId = makeId('exp');
  db.prepare(`INSERT INTO expenses (id, category, title, amount, expense_date, payment_method, vendor, receipt_number, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      expId, body.category, body.title, body.amount, body.expenseDate, body.paymentMethod,
      body.vendor, body.receiptNumber, body.notes, req.user?.id ?? null
    );
  recordAudit(req.user?.id ?? null, 'تسجيل مصروف', 'expense', expId, body);
  res.status(201).json(db.prepare('SELECT * FROM expenses WHERE id = ?').get(expId));
}));

app.delete('/api/expenses/:id', auth, role('owner', 'manager', 'accountant'), asyncRoute((req, res) => {
  const expId = param(req.params.id);
  db.prepare('DELETE FROM expenses WHERE id = ?').run(expId);
  recordAudit(req.user?.id ?? null, 'حذف مصروف', 'expense', expId, {});
  res.json({ message: 'تم حذف المصروف بنجاح' });
}));

app.get('/api/invoices/:id', auth, asyncRoute((req, res) => {
  const invoiceId = param(req.params.id); const invoice = db.prepare(`SELECT i.*, c.full_name AS client_name, c.phone AS client_phone, c.address AS client_address FROM invoices i LEFT JOIN clients c ON c.id = i.client_id WHERE i.id = ?`).get(invoiceId);
  if (!invoice) { res.status(404).json({ message: 'الفاتورة غير موجودة' }); return; }
  res.json({ invoice, items: db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(invoiceId), payments: db.prepare('SELECT * FROM payments WHERE invoice_id = ? ORDER BY created_at').all(invoiceId) });
}));

app.post('/api/invoices', auth, role('owner', 'manager', 'reception', 'accountant', 'pharmacist'), asyncRoute((req, res) => {
  const body = invoiceSchema.parse(req.body); const invoiceId = makeId('inv');
  if (!db.prepare('SELECT id FROM clients WHERE id = ?').get(body.clientId)) { res.status(400).json({ message: 'العميل غير موجود' }); return; }
  if (body.visitId && !db.prepare('SELECT id FROM visits WHERE id = ? AND client_id = ?').get(body.visitId, body.clientId)) { res.status(400).json({ message: 'الزيارة غير موجودة أو لا تتبع هذا العميل' }); return; }
  const subtotal = body.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0); const total = Math.max(0, subtotal - body.discount + body.tax); const paid = Math.min(body.paid, total);
  const today = localDateString().replaceAll('-', '');
  let invoiceNumber = '';
  db.exec('BEGIN IMMEDIATE');
  try {
    // Generated inside the transaction: computing it beforehand let two
    // concurrent invoices claim the same number and hit the UNIQUE constraint.
    const dailyCount = Number((db.prepare('SELECT COUNT(*) AS count FROM invoices WHERE invoice_number LIKE ?').get(`INV-${today}-%`) as { count: number }).count) + 1;
    invoiceNumber = `INV-${today}-${String(dailyCount).padStart(4, '0')}`;
    for (const item of body.items) {
      if (!item.productId) continue;
      const product = db.prepare('SELECT stock, name FROM products WHERE id = ? AND active = 1').get(item.productId) as { stock: number; name: string } | undefined;
      if (!product) throw new BusinessError(`الصنف ${item.description} غير موجود`, 400);
      if (product.stock < item.quantity) throw new BusinessError(`الرصيد غير كافٍ للصنف: ${product.name}`);
    }
    const status = paid >= total ? 'مدفوعة' : paid > 0 ? 'مدفوعة جزئيًا' : 'غير مدفوعة';
    db.prepare(`INSERT INTO invoices (id, invoice_number, client_id, pet_id, visit_id, subtotal, discount, tax, total, paid, status, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(invoiceId, invoiceNumber, body.clientId, body.petId || null, body.visitId || null, subtotal, body.discount, body.tax, total, paid, status, body.paymentMethod || 'نقدي');
    const addItem = db.prepare('INSERT INTO invoice_items (id, invoice_id, product_id, item_type, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    for (const item of body.items) {
      addItem.run(makeId('itm'), invoiceId, item.productId || null, item.itemType, item.description, item.quantity, item.unitPrice, item.quantity * item.unitPrice);
      if (item.productId) {
        db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.productId);
        db.prepare('INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_type, reference_id, user_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(makeId('mov'), item.productId, 'صرف', -item.quantity, 'invoice', invoiceId, req.user?.id ?? null, invoiceNumber);
      }
    }
    if (paid > 0) db.prepare('INSERT INTO payments (id, invoice_id, amount, method, received_by) VALUES (?, ?, ?, ?, ?)').run(makeId('pay'), invoiceId, paid, body.paymentMethod, req.user?.id ?? null);
    if (paid < total) db.prepare('UPDATE clients SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(total - paid, body.clientId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  recordAudit(req.user?.id ?? null, 'إصدار فاتورة', 'invoice', invoiceId, { invoiceNumber, total, paid });
  res.status(201).json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId));
}));

app.post('/api/invoices/:id/payments', auth, role('owner', 'manager', 'reception', 'accountant'), asyncRoute((req, res) => {
  const invoiceId = param(req.params.id);
  const body = z.object({ amount: z.coerce.number().positive(), method: z.string().min(2), reference: z.string().optional().default('') }).parse(req.body);
  const invoice = db.prepare('SELECT id, client_id, total, paid, status FROM invoices WHERE id = ?').get(invoiceId) as { id: string; client_id: string; total: number; paid: number; status: string } | undefined;
  if (!invoice) { res.status(404).json({ message: 'الفاتورة غير موجودة' }); return; }
  const remaining = invoice.total - invoice.paid;
  if (remaining <= 0) throw new BusinessError('الفاتورة مدفوعة بالكامل');
  if (body.amount > remaining) throw new BusinessError(`الدفعة أكبر من المتبقي (${remaining} ج.م)`);
  const newPaid = invoice.paid + body.amount; const newStatus = newPaid >= invoice.total ? 'مدفوعة' : 'مدفوعة جزئيًا';
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('INSERT INTO payments (id, invoice_id, amount, method, reference, received_by) VALUES (?, ?, ?, ?, ?, ?)').run(makeId('pay'), invoiceId, body.amount, body.method, body.reference, req.user?.id ?? null);
    db.prepare('UPDATE invoices SET paid = ?, status = ?, payment_method = ? WHERE id = ?').run(newPaid, newStatus, body.method, invoiceId);
    db.prepare('UPDATE clients SET balance = MAX(0, balance - ?), updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(body.amount, invoice.client_id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  recordAudit(req.user?.id ?? null, 'تحصيل دفعة', 'invoice', invoiceId, { amount: body.amount, method: body.method });
  res.status(201).json(db.prepare('SELECT * FROM invoices WHERE id = ?').get(invoiceId));
}));

app.patch('/api/appointments/:id/status', auth, role('owner', 'manager', 'reception', 'doctor', 'assistant'), asyncRoute((req, res) => {
  const body = z.object({ status: z.enum(['مؤكد', 'في الانتظار', 'وصل', 'داخل الكشف', 'مكتمل', 'ملغي', 'لم يحضر']) }).parse(req.body);
  const appointmentId = param(req.params.id);
  const result = db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(body.status, appointmentId);
  if (result.changes === 0) { res.status(404).json({ message: 'الموعد غير موجود' }); return; }
  recordAudit(req.user?.id ?? null, 'تغيير الحالة', 'appointment', appointmentId, body);
  res.json({ ok: true });
}));

app.get('/api/inventory', auth, asyncRoute((_req, res) => res.json(db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY name').all())));

const productSchema = z.object({
  sku: z.string().trim().min(2), name: z.string().trim().min(2), category: z.string().trim().min(2), unit: z.string().trim().min(1).default('قطعة'),
  salePrice: z.coerce.number().nonnegative(), purchasePrice: z.coerce.number().nonnegative().default(0), stock: z.coerce.number().nonnegative().default(0),
  minStock: z.coerce.number().nonnegative().default(0), expiryDate: z.string().optional().default(''),
});

app.post('/api/inventory', auth, role('owner', 'manager', 'pharmacist', 'inventory'), asyncRoute((req, res) => {
  const body = productSchema.parse(req.body); const productId = makeId('prd');
  if (db.prepare('SELECT id FROM products WHERE sku = ?').get(body.sku)) throw new BusinessError('كود الصنف/الباركود مستخدم بالفعل');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO products (id, sku, name, category, unit, sale_price, purchase_price, stock, min_stock, expiry_date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(productId, body.sku, body.name, body.category, body.unit, body.salePrice, body.purchasePrice, body.stock, body.minStock, body.expiryDate || null);
    if (body.stock > 0) db.prepare('INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_type, reference_id, user_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(makeId('mov'), productId, 'رصيد افتتاحي', body.stock, 'opening', productId, req.user?.id ?? null, 'رصيد افتتاحي');
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  recordAudit(req.user?.id ?? null, 'إضافة صنف', 'product', productId, { sku: body.sku, name: body.name });
  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(productId));
}));

app.post('/api/inventory/:id/adjustments', auth, role('owner', 'manager', 'pharmacist', 'inventory'), asyncRoute((req, res) => {
  const productId = param(req.params.id); const body = z.object({ quantity: z.coerce.number().refine((value) => value !== 0, 'الكمية لا تساوي صفرًا'), reason: z.string().trim().min(2) }).parse(req.body);
  const product = db.prepare('SELECT id, stock, name FROM products WHERE id = ? AND active = 1').get(productId) as { id: string; stock: number; name: string } | undefined;
  if (!product) { res.status(404).json({ message: 'الصنف غير موجود' }); return; }
  if (product.stock + body.quantity < 0) throw new BusinessError(`لا يمكن أن يصبح رصيد ${product.name} سالبًا`);
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(body.quantity, productId);
    db.prepare('INSERT INTO stock_movements (id, product_id, movement_type, quantity, reference_type, reference_id, user_id, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(makeId('mov'), productId, 'تسوية', body.quantity, 'adjustment', productId, req.user?.id ?? null, body.reason);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  recordAudit(req.user?.id ?? null, 'تسوية مخزون', 'product', productId, body);
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(productId));
}));

app.get('/api/inventory/:id/movements', auth, asyncRoute((req, res) => {
  const productId = param(req.params.id);
  const movements = db.prepare(`SELECT m.*, u.name AS user_name FROM stock_movements m LEFT JOIN users u ON u.id = m.user_id WHERE m.product_id = ? ORDER BY m.created_at DESC`).all(productId);
  res.json(movements);
}));

// Advanced clinical operations: surgery, anesthesia, inpatient care and nursing.
const surgerySchema = z.object({
  clientId: z.string().min(1), petId: z.string().min(1), visitId: z.string().optional().default(''),
  procedureName: z.string().trim().min(2), scheduledAt: z.string().min(10), riskLevel: z.enum(['منخفض', 'متوسط', 'مرتفع']).default('متوسط'),
  consentSigned: z.boolean().default(false), fastingConfirmed: z.boolean().default(false), preopAssessment: z.string().optional().default(''),
  anesthesiaProtocol: z.string().optional().default(''), procedureNotes: z.string().optional().default(''), recoveryNotes: z.string().optional().default(''), complications: z.string().optional().default(''),
});

app.get('/api/surgeries', auth, asyncRoute((_req, res) => {
  res.json(db.prepare(`SELECT s.*, p.name AS pet_name, p.species, c.full_name AS client_name, c.phone AS client_phone, u.name AS doctor_name
    FROM surgeries s JOIN pets p ON p.id = s.pet_id JOIN clients c ON c.id = s.client_id LEFT JOIN users u ON u.id = s.doctor_id
    ORDER BY s.scheduled_at DESC`).all());
}));

app.post('/api/surgeries', auth, role('owner', 'manager', 'doctor'), asyncRoute((req, res) => {
  const body = surgerySchema.parse(req.body); const relation = db.prepare('SELECT id FROM pets WHERE id = ? AND client_id = ?').get(body.petId, body.clientId);
  if (!relation) throw new BusinessError('بيانات العميل والحيوان غير مترابطة', 400);
  const surgeryId = makeId('srg');
  db.prepare(`INSERT INTO surgeries (id, client_id, pet_id, visit_id, doctor_id, procedure_name, scheduled_at, risk_level, consent_signed, fasting_confirmed, preop_assessment, anesthesia_protocol, procedure_notes, recovery_notes, complications)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(surgeryId, body.clientId, body.petId, body.visitId || null, req.user?.id ?? null, body.procedureName, body.scheduledAt, body.riskLevel, body.consentSigned ? 1 : 0, body.fastingConfirmed ? 1 : 0, body.preopAssessment, body.anesthesiaProtocol, body.procedureNotes, body.recoveryNotes, body.complications);
  recordAudit(req.user?.id ?? null, 'حجز عملية', 'surgery', surgeryId, { procedure: body.procedureName, petId: body.petId });
  res.status(201).json(db.prepare('SELECT * FROM surgeries WHERE id = ?').get(surgeryId));
}));

app.patch('/api/surgeries/:id/status', auth, role('owner', 'manager', 'doctor', 'assistant'), asyncRoute((req, res) => {
  const surgeryId = param(req.params.id); const body = z.object({ status: z.enum(['مجدولة', 'قبل العملية', 'جارية', 'الإفاقة', 'مكتملة', 'ملغاة']) }).parse(req.body);
  const result = db.prepare('UPDATE surgeries SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(body.status, surgeryId);
  if (result.changes === 0) throw new BusinessError('العملية غير موجودة', 404);
  recordAudit(req.user?.id ?? null, 'تغيير حالة عملية', 'surgery', surgeryId, body); res.json({ ok: true });
}));

app.get('/api/surgeries/:id/anesthesia', auth, asyncRoute((req, res) => {
  const surgeryId = param(req.params.id); res.json(db.prepare('SELECT a.*, u.name AS recorded_by_name FROM anesthesia_logs a LEFT JOIN users u ON u.id = a.recorded_by WHERE a.surgery_id = ? ORDER BY a.recorded_at').all(surgeryId));
}));

app.post('/api/surgeries/:id/anesthesia', auth, role('owner', 'manager', 'doctor', 'assistant'), asyncRoute((req, res) => {
  const surgeryId = param(req.params.id); if (!db.prepare('SELECT id FROM surgeries WHERE id = ?').get(surgeryId)) throw new BusinessError('العملية غير موجودة', 404);
  const body = z.object({ recordedAt: z.string().min(10), heartRate: z.coerce.number().optional(), respiratoryRate: z.coerce.number().optional(), spo2: z.coerce.number().min(0).max(100).optional(), temperature: z.coerce.number().optional(), bloodPressure: z.string().optional().default(''), anestheticDepth: z.string().optional().default(''), notes: z.string().optional().default('') }).parse(req.body);
  const logId = makeId('an'); db.prepare(`INSERT INTO anesthesia_logs (id, surgery_id, recorded_at, heart_rate, respiratory_rate, spo2, temperature, blood_pressure, anesthetic_depth, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(logId, surgeryId, body.recordedAt, body.heartRate ?? null, body.respiratoryRate ?? null, body.spo2 ?? null, body.temperature ?? null, body.bloodPressure, body.anestheticDepth, body.notes, req.user?.id ?? null);
  recordAudit(req.user?.id ?? null, 'تسجيل مراقبة تخدير', 'surgery', surgeryId, body); res.status(201).json(db.prepare('SELECT * FROM anesthesia_logs WHERE id = ?').get(logId));
}));

// Admissions and boarding draw from the same physical `cages` table, so an
// occupancy check that looks at only one of them lets a cage be double-booked.
const ACTIVE_ADMISSION_STATUSES = ['محجوز', 'منوّم', 'خروج متوقع'] as const;
const ACTIVE_BOARDING_STATUSES = ['محجوز', 'مقيم', 'جاهز للخروج'] as const;

function assertCageFree(cageId: string, from: string, to: string, ignoreBoardingId?: string): void {
  if (!cageId) return;
  const cage = db.prepare('SELECT id FROM cages WHERE id = ? AND active = 1').get(cageId);
  if (!cage) throw new BusinessError('القفص غير موجود أو غير مفعّل', 400);
  const admissionClash = db.prepare(`SELECT id FROM admissions WHERE cage_id = ?
    AND status IN (${ACTIVE_ADMISSION_STATUSES.map(() => '?').join(', ')})
    AND admitted_at < ? AND COALESCE(discharged_at, expected_discharge_at, '9999-12-31') > ?`)
    .get(cageId, ...ACTIVE_ADMISSION_STATUSES, to, from);
  if (admissionClash) throw new BusinessError('القفص مشغول بحالة تنويم في هذه الفترة');
  const boardingClash = db.prepare(`SELECT id FROM boarding_bookings WHERE cage_id = ?
    AND id IS NOT ?
    AND status IN (${ACTIVE_BOARDING_STATUSES.map(() => '?').join(', ')})
    AND check_in_at < ? AND COALESCE(actual_check_out_at, check_out_at) > ?`)
    .get(cageId, ignoreBoardingId ?? null, ...ACTIVE_BOARDING_STATUSES, to, from);
  if (boardingClash) throw new BusinessError('القفص محجوز للفندق في هذه الفترة');
}

app.get('/api/cages', auth, asyncRoute((_req, res) => res.json(db.prepare(`SELECT c.*,
  ((SELECT COUNT(*) FROM admissions a WHERE a.cage_id = c.id AND a.status IN ('محجوز', 'منوّم', 'خروج متوقع'))
   + (SELECT COUNT(*) FROM boarding_bookings b WHERE b.cage_id = c.id AND b.status IN ('محجوز', 'مقيم', 'جاهز للخروج'))) AS occupied
  FROM cages c WHERE c.active = 1 ORDER BY c.cage_type, c.name`).all())));

const admissionSchema = z.object({
  clientId: z.string().min(1), petId: z.string().min(1), cageId: z.string().optional().default(''), admittedAt: z.string().min(10), expectedDischargeAt: z.string().optional().default(''), reason: z.string().trim().min(2), diagnosis: z.string().optional().default(''), dietPlan: z.string().optional().default(''), dailyRate: z.coerce.number().nonnegative().default(0), dischargeInstructions: z.string().optional().default(''), notes: z.string().optional().default(''),
  treatmentOrders: z.array(z.object({ medication: z.string().min(1), dosage: z.string().min(1), route: z.string().optional().default(''), frequency: z.string().min(1), nextDueAt: z.string().optional().default(''), instructions: z.string().optional().default('') })).default([]),
});

app.get('/api/admissions', auth, asyncRoute((_req, res) => res.json(db.prepare(`SELECT a.*, p.name AS pet_name, p.species, c.full_name AS client_name, c.phone AS client_phone, cg.name AS cage_name, u.name AS doctor_name FROM admissions a JOIN pets p ON p.id = a.pet_id JOIN clients c ON c.id = a.client_id LEFT JOIN cages cg ON cg.id = a.cage_id LEFT JOIN users u ON u.id = a.doctor_id ORDER BY a.status = 'منوّم' DESC, a.admitted_at DESC`).all())));

app.get('/api/admissions/:id', auth, asyncRoute((req, res) => {
  const admissionId = param(req.params.id); const admission = db.prepare(`SELECT a.*, p.name AS pet_name, p.species, c.full_name AS client_name, cg.name AS cage_name FROM admissions a JOIN pets p ON p.id = a.pet_id JOIN clients c ON c.id = a.client_id LEFT JOIN cages cg ON cg.id = a.cage_id WHERE a.id = ?`).get(admissionId);
  if (!admission) throw new BusinessError('ملف التنويم غير موجود', 404);
  res.json({ admission, orders: db.prepare('SELECT * FROM treatment_orders WHERE admission_id = ? ORDER BY created_at').all(admissionId), nursing: db.prepare('SELECT * FROM nursing_logs WHERE admission_id = ? ORDER BY recorded_at DESC').all(admissionId) });
}));

app.post('/api/admissions', auth, role('owner', 'manager', 'doctor', 'assistant'), asyncRoute((req, res) => {
  const body = admissionSchema.parse(req.body); const relation = db.prepare('SELECT id FROM pets WHERE id = ? AND client_id = ?').get(body.petId, body.clientId);
  if (!relation) throw new BusinessError('بيانات العميل والحيوان غير مترابطة', 400);
  assertCageFree(body.cageId, body.admittedAt, body.expectedDischargeAt || '9999-12-31');
  const admissionId = makeId('adm'); db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO admissions (id, client_id, pet_id, doctor_id, cage_id, admitted_at, expected_discharge_at, reason, diagnosis, diet_plan, daily_rate, discharge_instructions, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(admissionId, body.clientId, body.petId, req.user?.id ?? null, body.cageId || null, body.admittedAt, body.expectedDischargeAt || null, body.reason, body.diagnosis, body.dietPlan, body.dailyRate, body.dischargeInstructions, body.notes);
    const order = db.prepare('INSERT INTO treatment_orders (id, admission_id, medication, dosage, route, frequency, next_due_at, instructions, ordered_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (const item of body.treatmentOrders) order.run(makeId('ord'), admissionId, item.medication, item.dosage, item.route, item.frequency, item.nextDueAt || null, item.instructions, req.user?.id ?? null);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  recordAudit(req.user?.id ?? null, 'إدخال تنويم', 'admission', admissionId, { petId: body.petId }); res.status(201).json(db.prepare('SELECT * FROM admissions WHERE id = ?').get(admissionId));
}));

app.patch('/api/admissions/:id/status', auth, role('owner', 'manager', 'doctor', 'assistant'), asyncRoute((req, res) => {
  const admissionId = param(req.params.id);
  const body = z.object({ status: z.enum(['محجوز', 'منوّم', 'خروج متوقع', 'مخرج', 'ملغى']), dischargeInstructions: z.string().optional() }).parse(req.body);
  const current = db.prepare('SELECT discharge_instructions FROM admissions WHERE id = ?').get(admissionId) as { discharge_instructions: string | null } | undefined;
  if (!current) throw new BusinessError('ملف التنويم غير موجود', 404);
  const dischargedAt = body.status === 'مخرج' ? new Date().toISOString() : null;
  db.prepare('UPDATE admissions SET status = ?, discharged_at = COALESCE(?, discharged_at), discharge_instructions = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
    .run(body.status, dischargedAt, body.dischargeInstructions ?? current.discharge_instructions, admissionId);
  recordAudit(req.user?.id ?? null, 'تغيير حالة تنويم', 'admission', admissionId, body);
  res.json(db.prepare('SELECT * FROM admissions WHERE id = ?').get(admissionId));
}));

app.post('/api/admissions/:id/nursing', auth, role('owner', 'manager', 'doctor', 'assistant'), asyncRoute((req, res) => {
  const admissionId = param(req.params.id); if (!db.prepare('SELECT id FROM admissions WHERE id = ?').get(admissionId)) throw new BusinessError('ملف التنويم غير موجود', 404);
  const body = z.object({ logType: z.string().min(2), recordedAt: z.string().min(10), temperature: z.coerce.number().optional(), heartRate: z.coerce.number().optional(), respiratoryRate: z.coerce.number().optional(), weightKg: z.coerce.number().optional(), medication: z.string().optional().default(''), dosage: z.string().optional().default(''), feeding: z.string().optional().default(''), fluids: z.string().optional().default(''), notes: z.string().optional().default('') }).parse(req.body);
  const logId = makeId('nrs'); db.prepare(`INSERT INTO nursing_logs (id, admission_id, log_type, recorded_at, temperature, heart_rate, respiratory_rate, weight_kg, medication, dosage, feeding, fluids, notes, recorded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(logId, admissionId, body.logType, body.recordedAt, body.temperature ?? null, body.heartRate ?? null, body.respiratoryRate ?? null, body.weightKg ?? null, body.medication, body.dosage, body.feeding, body.fluids, body.notes, req.user?.id ?? null);
  recordAudit(req.user?.id ?? null, 'تسجيل تمريض', 'admission', admissionId, { logType: body.logType }); res.status(201).json(db.prepare('SELECT * FROM nursing_logs WHERE id = ?').get(logId));
}));

// Laboratory and imaging workflow.
const labOrderSchema = z.object({
  clientId: z.string().min(1), petId: z.string().min(1), visitId: z.string().optional().default(''), testName: z.string().trim().min(2), specimen: z.string().optional().default(''), priority: z.enum(['عادي', 'عاجل', 'حرج']).default('عادي'), notes: z.string().optional().default(''),
});

app.get('/api/lab/orders', auth, asyncRoute((_req, res) => res.json(db.prepare(`SELECT l.*, p.name AS pet_name, p.species, c.full_name AS client_name, c.phone AS client_phone, u.name AS doctor_name FROM lab_orders l JOIN pets p ON p.id = l.pet_id JOIN clients c ON c.id = l.client_id LEFT JOIN users u ON u.id = l.doctor_id ORDER BY l.requested_at DESC`).all())));

app.post('/api/lab/orders', auth, role('owner', 'manager', 'doctor', 'assistant', 'lab'), asyncRoute((req, res) => {
  const body = labOrderSchema.parse(req.body); const relation = db.prepare('SELECT id FROM pets WHERE id = ? AND client_id = ?').get(body.petId, body.clientId);
  if (!relation) throw new BusinessError('بيانات العميل والحيوان غير مترابطة', 400);
  const orderId = makeId('lab'); db.prepare(`INSERT INTO lab_orders (id, client_id, pet_id, visit_id, doctor_id, test_name, specimen, priority, requested_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(orderId, body.clientId, body.petId, body.visitId || null, req.user?.id ?? null, body.testName, body.specimen, body.priority, new Date().toISOString(), body.notes);
  recordAudit(req.user?.id ?? null, 'طلب تحليل', 'lab_order', orderId, { testName: body.testName, petId: body.petId }); res.status(201).json(db.prepare('SELECT * FROM lab_orders WHERE id = ?').get(orderId));
}));

app.patch('/api/lab/orders/:id', auth, role('owner', 'manager', 'doctor', 'lab'), asyncRoute((req, res) => {
  const orderId = param(req.params.id);
  const body = z.object({ status: z.enum(['مطلوب', 'عينة مستلمة', 'قيد التحليل', 'مكتمل', 'ملغى']), result: z.string().optional(), referenceRange: z.string().optional(), isCritical: z.boolean().optional(), notes: z.string().optional() }).parse(req.body);
  const current = db.prepare('SELECT result, reference_range, is_critical, notes FROM lab_orders WHERE id = ?').get(orderId) as { result: string | null; reference_range: string | null; is_critical: number; notes: string | null } | undefined;
  if (!current) throw new BusinessError('طلب التحليل غير موجود', 404);
  // Only overwrite the fields the caller actually sent; the results table
  // patches status alone and must not erase a result already entered.
  const collectedAt = body.status === 'عينة مستلمة' ? new Date().toISOString() : null;
  const completedAt = body.status === 'مكتمل' ? new Date().toISOString() : null;
  db.prepare('UPDATE lab_orders SET status = ?, result = ?, reference_range = ?, is_critical = ?, notes = ?, collected_at = COALESCE(collected_at, ?), completed_at = COALESCE(?, completed_at) WHERE id = ?')
    .run(body.status, body.result ?? current.result, body.referenceRange ?? current.reference_range, body.isCritical === undefined ? current.is_critical : body.isCritical ? 1 : 0, body.notes ?? current.notes, collectedAt, completedAt, orderId);
  recordAudit(req.user?.id ?? null, 'تحديث تحليل', 'lab_order', orderId, body);
  res.json(db.prepare('SELECT * FROM lab_orders WHERE id = ?').get(orderId));
}));

const imagingSchema = z.object({ clientId: z.string().min(1), petId: z.string().min(1), visitId: z.string().optional().default(''), modality: z.enum(['أشعة X-Ray', 'سونار', 'منظار', 'أخرى']), bodyRegion: z.string().trim().min(2), priority: z.enum(['عادي', 'عاجل']).default('عادي'), notes: z.string().optional().default('') });
app.get('/api/imaging/orders', auth, asyncRoute((_req, res) => res.json(db.prepare(`SELECT i.*, p.name AS pet_name, p.species, c.full_name AS client_name, c.phone AS client_phone, u.name AS doctor_name FROM imaging_orders i JOIN pets p ON p.id = i.pet_id JOIN clients c ON c.id = i.client_id LEFT JOIN users u ON u.id = i.doctor_id ORDER BY i.requested_at DESC`).all())));
app.post('/api/imaging/orders', auth, role('owner', 'manager', 'doctor', 'assistant', 'lab'), asyncRoute((req, res) => {
  const body = imagingSchema.parse(req.body); const relation = db.prepare('SELECT id FROM pets WHERE id = ? AND client_id = ?').get(body.petId, body.clientId); if (!relation) throw new BusinessError('بيانات العميل والحيوان غير مترابطة', 400);
  const orderId = makeId('img'); db.prepare(`INSERT INTO imaging_orders (id, client_id, pet_id, visit_id, doctor_id, modality, body_region, priority, requested_at, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(orderId, body.clientId, body.petId, body.visitId || null, req.user?.id ?? null, body.modality, body.bodyRegion, body.priority, new Date().toISOString(), body.notes); recordAudit(req.user?.id ?? null, 'طلب أشعة', 'imaging_order', orderId, body); res.status(201).json(db.prepare('SELECT * FROM imaging_orders WHERE id = ?').get(orderId));
}));
app.patch('/api/imaging/orders/:id', auth, role('owner', 'manager', 'doctor', 'lab'), asyncRoute((req, res) => {
  const orderId = param(req.params.id);
  const body = z.object({ status: z.enum(['مطلوب', 'قيد التنفيذ', 'مكتمل', 'ملغى']), report: z.string().optional(), findings: z.string().optional(), notes: z.string().optional() }).parse(req.body);
  const current = db.prepare('SELECT report, findings, notes FROM imaging_orders WHERE id = ?').get(orderId) as { report: string | null; findings: string | null; notes: string | null } | undefined;
  if (!current) throw new BusinessError('طلب الأشعة غير موجود', 404);
  const completedAt = body.status === 'مكتمل' ? new Date().toISOString() : null;
  db.prepare('UPDATE imaging_orders SET status = ?, report = ?, findings = ?, notes = ?, completed_at = COALESCE(?, completed_at) WHERE id = ?')
    .run(body.status, body.report ?? current.report, body.findings ?? current.findings, body.notes ?? current.notes, completedAt, orderId);
  recordAudit(req.user?.id ?? null, 'تحديث أشعة', 'imaging_order', orderId, body);
  res.json(db.prepare('SELECT * FROM imaging_orders WHERE id = ?').get(orderId));
}));

// Grooming and boarding/hotel services.
const groomingSchema = z.object({ clientId: z.string().min(1), petId: z.string().min(1), service: z.string().trim().min(2), bookingDate: z.string().min(8), bookingTime: z.string().min(4), groomerName: z.string().optional().default(''), price: z.coerce.number().nonnegative().default(0), specialInstructions: z.string().optional().default('') });
app.get('/api/grooming', auth, asyncRoute((_req, res) => res.json(db.prepare(`SELECT g.*, p.name AS pet_name, p.species, c.full_name AS client_name, c.phone AS client_phone FROM grooming_bookings g JOIN pets p ON p.id = g.pet_id JOIN clients c ON c.id = g.client_id ORDER BY g.booking_date DESC, g.booking_time`).all())));
app.post('/api/grooming', auth, role('owner', 'manager', 'reception'), asyncRoute((req, res) => {
  const body = groomingSchema.parse(req.body); const relation = db.prepare('SELECT id FROM pets WHERE id = ? AND client_id = ?').get(body.petId, body.clientId); if (!relation) throw new BusinessError('بيانات العميل والحيوان غير مترابطة', 400); const bookingId = makeId('grm'); db.prepare(`INSERT INTO grooming_bookings (id, client_id, pet_id, service, booking_date, booking_time, groomer_name, price, special_instructions) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(bookingId, body.clientId, body.petId, body.service, body.bookingDate, body.bookingTime, body.groomerName, body.price, body.specialInstructions); recordAudit(req.user?.id ?? null, 'حجز Grooming', 'grooming', bookingId, body); res.status(201).json(db.prepare('SELECT * FROM grooming_bookings WHERE id = ?').get(bookingId));
}));
app.patch('/api/grooming/:id', auth, role('owner', 'manager', 'reception', 'assistant'), asyncRoute((req, res) => {
  const bookingId = param(req.params.id);
  const body = z.object({ status: z.enum(['مؤكد', 'وصل', 'قيد التنفيذ', 'مكتمل', 'ملغى']), beforeNotes: z.string().optional(), afterNotes: z.string().optional() }).parse(req.body);
  const current = db.prepare('SELECT before_notes, after_notes FROM grooming_bookings WHERE id = ?').get(bookingId) as { before_notes: string | null; after_notes: string | null } | undefined;
  if (!current) throw new BusinessError('حجز Grooming غير موجود', 404);
  db.prepare('UPDATE grooming_bookings SET status = ?, before_notes = ?, after_notes = ? WHERE id = ?')
    .run(body.status, body.beforeNotes ?? current.before_notes, body.afterNotes ?? current.after_notes, bookingId);
  recordAudit(req.user?.id ?? null, 'تحديث Grooming', 'grooming', bookingId, body);
  res.json(db.prepare('SELECT * FROM grooming_bookings WHERE id = ?').get(bookingId));
}));

const boardingSchema = z.object({ clientId: z.string().min(1), petId: z.string().min(1), cageId: z.string().optional().default(''), checkInAt: z.string().min(10), checkOutAt: z.string().min(10), nightlyRate: z.coerce.number().nonnegative().default(0), feedingPlan: z.string().optional().default(''), medicationPlan: z.string().optional().default(''), emergencyContact: z.string().optional().default(''), belongings: z.string().optional().default(''), vaccinationVerified: z.boolean().default(false), notes: z.string().optional().default('') });
app.get('/api/boarding', auth, asyncRoute((_req, res) => res.json(db.prepare(`SELECT b.*, p.name AS pet_name, p.species, c.full_name AS client_name, c.phone AS client_phone, cg.name AS cage_name FROM boarding_bookings b JOIN pets p ON p.id = b.pet_id JOIN clients c ON c.id = b.client_id LEFT JOIN cages cg ON cg.id = b.cage_id ORDER BY b.check_in_at DESC`).all())));
app.post('/api/boarding', auth, role('owner', 'manager', 'reception'), asyncRoute((req, res) => { const body = boardingSchema.parse(req.body); const relation = db.prepare('SELECT id FROM pets WHERE id = ? AND client_id = ?').get(body.petId, body.clientId); if (!relation) throw new BusinessError('بيانات العميل والحيوان غير مترابطة', 400); if (body.checkOutAt <= body.checkInAt) throw new BusinessError('تاريخ الخروج يجب أن يكون بعد تاريخ الدخول', 400); assertCageFree(body.cageId, body.checkInAt, body.checkOutAt); const idValue = makeId('brd'); db.prepare(`INSERT INTO boarding_bookings (id, client_id, pet_id, cage_id, check_in_at, check_out_at, nightly_rate, feeding_plan, medication_plan, emergency_contact, belongings, vaccination_verified, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(idValue, body.clientId, body.petId, body.cageId || null, body.checkInAt, body.checkOutAt, body.nightlyRate, body.feedingPlan, body.medicationPlan, body.emergencyContact, body.belongings, body.vaccinationVerified ? 1 : 0, body.notes); recordAudit(req.user?.id ?? null, 'حجز فندق', 'boarding', idValue, body); res.status(201).json(db.prepare('SELECT * FROM boarding_bookings WHERE id = ?').get(idValue)); }));
app.patch('/api/boarding/:id', auth, role('owner', 'manager', 'reception', 'assistant'), asyncRoute((req, res) => { const bookingId = param(req.params.id); const body = z.object({ status: z.enum(['محجوز', 'مقيم', 'جاهز للخروج', 'مكتمل', 'ملغى']), actualCheckOutAt: z.string().optional().default('') }).parse(req.body); const result = db.prepare('UPDATE boarding_bookings SET status = ?, actual_check_out_at = COALESCE(NULLIF(?, \'\'), actual_check_out_at) WHERE id = ?').run(body.status, body.actualCheckOutAt, bookingId); if (result.changes === 0) throw new BusinessError('حجز الفندق غير موجود', 404); recordAudit(req.user?.id ?? null, 'تحديث فندق', 'boarding', bookingId, body); res.json({ ok: true }); }));
app.post('/api/boarding/:id/logs', auth, role('owner', 'manager', 'assistant', 'reception'), asyncRoute((req, res) => { const bookingId = param(req.params.id); const body = z.object({ logType: z.string().min(2), recordedAt: z.string().min(10), details: z.string().min(2) }).parse(req.body); if (!db.prepare('SELECT id FROM boarding_bookings WHERE id = ?').get(bookingId)) throw new BusinessError('حجز الفندق غير موجود', 404); const logId = makeId('blog'); db.prepare('INSERT INTO boarding_logs (id, boarding_id, log_type, recorded_at, details, recorded_by) VALUES (?, ?, ?, ?, ?, ?)').run(logId, bookingId, body.logType, body.recordedAt, body.details, req.user?.id ?? null); recordAudit(req.user?.id ?? null, 'تسجيل فندق', 'boarding', bookingId, body); res.status(201).json(db.prepare('SELECT * FROM boarding_logs WHERE id = ?').get(logId)); }));

// Staff, settings and executive reports.
app.get('/api/staff', auth, role('owner', 'manager'), asyncRoute((_req, res) => res.json(db.prepare(`SELECT id, name, username, role, active, created_at FROM users ORDER BY active DESC, name`).all())));
app.post('/api/staff', auth, role('owner'), asyncRoute((req, res) => {
  const body = z.object({ name: z.string().trim().min(2), username: z.string().trim().min(3), password: z.string().min(6), role: z.enum(['owner', 'manager', 'reception', 'doctor', 'assistant', 'pharmacist', 'inventory', 'accountant', 'lab']) }).parse(req.body); if (db.prepare('SELECT id FROM users WHERE username = ?').get(body.username)) throw new BusinessError('اسم المستخدم مستخدم بالفعل'); const userId = makeId('usr'); db.prepare('INSERT INTO users (id, name, username, password_hash, role) VALUES (?, ?, ?, ?, ?)').run(userId, body.name, body.username, hashPassword(body.password), body.role); recordAudit(req.user?.id ?? null, 'إضافة موظف', 'user', userId, { name: body.name, role: body.role }); res.status(201).json(db.prepare('SELECT id, name, username, role, active FROM users WHERE id = ?').get(userId));
}));
app.patch('/api/staff/:id', auth, role('owner'), asyncRoute((req, res) => { const userId = param(req.params.id); const body = z.object({ active: z.boolean().optional(), role: z.enum(['owner', 'manager', 'reception', 'doctor', 'assistant', 'pharmacist', 'inventory', 'accountant', 'lab']).optional(), name: z.string().min(2).optional() }).parse(req.body); const current = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as { active: number; role: string; name: string } | undefined; if (!current) throw new BusinessError('الموظف غير موجود', 404); db.prepare('UPDATE users SET active = ?, role = ?, name = ? WHERE id = ?').run(body.active === undefined ? current.active : body.active ? 1 : 0, body.role ?? current.role, body.name ?? current.name, userId); recordAudit(req.user?.id ?? null, 'تعديل موظف', 'user', userId, body); res.json({ ok: true }); }));
app.get('/api/staff/shifts', auth, role('owner', 'manager'), asyncRoute((_req, res) => res.json(db.prepare(`SELECT s.*, u.name AS user_name, u.role FROM employee_shifts s JOIN users u ON u.id = s.user_id ORDER BY s.shift_date DESC, s.start_time`).all())));
app.post('/api/staff/shifts', auth, role('owner', 'manager'), asyncRoute((req, res) => { const body = z.object({ userId: z.string().min(1), shiftDate: z.string().min(8), startTime: z.string().min(4), endTime: z.string().min(4), notes: z.string().optional().default('') }).parse(req.body); const shiftId = makeId('shf'); db.prepare('INSERT INTO employee_shifts (id, user_id, shift_date, start_time, end_time, notes) VALUES (?, ?, ?, ?, ?, ?)').run(shiftId, body.userId, body.shiftDate, body.startTime, body.endTime, body.notes); recordAudit(req.user?.id ?? null, 'إضافة وردية', 'shift', shiftId, body); res.status(201).json(db.prepare('SELECT * FROM employee_shifts WHERE id = ?').get(shiftId)); }));

app.get('/api/settings', auth, role('owner', 'manager'), asyncRoute((_req, res) => { const rows = db.prepare('SELECT setting_key, setting_value FROM clinic_settings ORDER BY setting_key').all() as Array<{ setting_key: string; setting_value: string }>; res.json(Object.fromEntries(rows.map((row) => [row.setting_key, row.setting_value]))); }));
app.put('/api/settings', auth, role('owner', 'manager'), asyncRoute((req, res) => { const body = z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).parse(req.body); const upsert = db.prepare(`INSERT INTO clinic_settings (setting_key, setting_value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(setting_key) DO UPDATE SET setting_value = excluded.setting_value, updated_at = CURRENT_TIMESTAMP`); db.exec('BEGIN IMMEDIATE'); try { for (const [key, value] of Object.entries(body)) upsert.run(key, String(value)); db.exec('COMMIT'); } catch (error) { db.exec('ROLLBACK'); throw error; } recordAudit(req.user?.id ?? null, 'تحديث الإعدادات', 'settings', null, Object.keys(body)); res.json({ ok: true }); }));

app.get('/api/reports/summary', auth, role('owner', 'manager', 'accountant'), asyncRoute((req, res) => {
  const from = String(req.query.from ?? `${localDateString().slice(0, 7)}-01`); const to = String(req.query.to ?? localDateString());
  const scalar = (sql: string, ...values: Array<string | number>) => Number((db.prepare(sql).get(...values) as { value: number }).value ?? 0);
  res.json({
    from, to,
    revenue: scalar("SELECT COALESCE(SUM(paid), 0) AS value FROM invoices WHERE date(created_at, 'localtime') BETWEEN ? AND ?", from, to),
    billed: scalar("SELECT COALESCE(SUM(total), 0) AS value FROM invoices WHERE date(created_at, 'localtime') BETWEEN ? AND ?", from, to),
    visits: scalar('SELECT COUNT(*) AS value FROM visits WHERE visit_date BETWEEN ? AND ?', from, to),
    newClients: scalar("SELECT COUNT(*) AS value FROM clients WHERE date(created_at, 'localtime') BETWEEN ? AND ?", from, to),
    vaccinations: scalar('SELECT COUNT(*) AS value FROM vaccinations WHERE administered_date BETWEEN ? AND ?', from, to),
    surgeries: scalar("SELECT COUNT(*) AS value FROM surgeries WHERE date(scheduled_at) BETWEEN ? AND ?", from, to),
    admissions: scalar("SELECT COUNT(*) AS value FROM admissions WHERE date(admitted_at) BETWEEN ? AND ?", from, to),
    labOrders: scalar("SELECT COUNT(*) AS value FROM lab_orders WHERE date(requested_at) BETWEEN ? AND ?", from, to),
    groomingRevenue: scalar('SELECT COALESCE(SUM(price), 0) AS value FROM grooming_bookings WHERE booking_date BETWEEN ? AND ? AND status != \'ملغى\'', from, to),
    outstanding: scalar('SELECT COALESCE(SUM(balance), 0) AS value FROM clients'),
    topServices: db.prepare(`SELECT description, SUM(quantity) AS quantity, SUM(total) AS total FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id WHERE date(i.created_at, 'localtime') BETWEEN ? AND ? GROUP BY description ORDER BY total DESC LIMIT 8`).all(from, to),
  });
}));

app.get('/api/operations/summary', auth, asyncRoute((_req, res) => {
  const count = (table: string, where = '1=1') => Number((db.prepare(`SELECT COUNT(*) AS value FROM ${table} WHERE ${where}`).get() as { value: number }).value);
  res.json({ surgeries: count('surgeries'), activeAdmissions: count('admissions', "status = 'منوّم'"), pendingLab: count('lab_orders', "status != 'مكتمل' AND status != 'ملغى'"), pendingImaging: count('imaging_orders', "status != 'مكتمل' AND status != 'ملغى'"), grooming: count('grooming_bookings'), activeBoarding: count('boarding_bookings', "status IN ('محجوز', 'مقيم')"), staff: count('users', 'active = 1') });
}));
app.get('/api/audit-logs', auth, role('owner', 'manager'), asyncRoute((_req, res) => res.json(db.prepare(`SELECT a.*, u.name AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 100`).all())));
app.get('/api/activity', auth, asyncRoute((_req, res) => res.json(db.prepare(`SELECT a.id, a.action, a.entity, a.entity_id, a.details, a.created_at, COALESCE(u.name, 'النظام') AS user_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.created_at DESC LIMIT 6`).all())));

app.get('/api/system/backup', auth, role('owner', 'manager'), asyncRoute((_req, res) => {
  db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
  const backupDirectory = resolve(dirname(databasePath), 'backups');
  mkdirSync(backupDirectory, { recursive: true });
  const fileName = `vet-clinic-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite`;
  const backupPath = resolve(backupDirectory, fileName);
  copyFileSync(databasePath, backupPath);
  res.download(backupPath, basename(backupPath));
}));

app.get('/api/system/export-json', auth, role('owner', 'manager'), asyncRoute((_req, res) => {
  const tableNames = [
    'users', 'clinic_settings', 'clients', 'pets', 'visits', 'prescriptions',
    'appointments', 'invoices', 'invoice_items', 'payments', 'expenses',
    'products', 'stock_movements', 'vaccinations', 'reminders', 'surgeries',
    'admissions', 'lab_tests', 'lab_orders', 'imaging_orders',
    'grooming_bookings', 'boarding_bookings', 'attachments'
  ];
  const dump: Record<string, any[]> = {};
  for (const t of tableNames) {
    try {
      dump[t] = db.prepare(`SELECT * FROM ${t}`).all();
    } catch {
      dump[t] = [];
    }
  }
  const payload = {
    version: '1.0',
    exported_at: new Date().toISOString(),
    tables: dump
  };
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=vet-clinic-backup-${new Date().toISOString().slice(0, 10)}.json`);
  res.send(JSON.stringify(payload, null, 2));
}));

app.post('/api/system/restore-json', auth, role('owner', 'manager'), asyncRoute((req, res) => {
  const payload = req.body;
  const tablesData = payload.tables || payload;
  if (!tablesData || typeof tablesData !== 'object') {
    res.status(400).json({ message: 'ملف النسخة الاحتياطية غير صالح' });
    return;
  }
  const tableOrder = [
    'attachments', 'boarding_bookings', 'grooming_bookings', 'imaging_orders', 'lab_orders',
    'lab_tests', 'admissions', 'surgeries', 'reminders', 'vaccinations', 'stock_movements',
    'invoice_items', 'payments', 'expenses', 'invoices', 'prescriptions', 'visits',
    'appointments', 'products', 'pets', 'clients', 'clinic_settings', 'users'
  ];

  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('PRAGMA foreign_keys = OFF');
    for (const t of tableOrder) {
      try { db.prepare(`DELETE FROM ${t}`).run(); } catch {}
    }
    const restoreOrder = [...tableOrder].reverse();
    for (const t of restoreOrder) {
      const rows = tablesData[t];
      if (Array.isArray(rows) && rows.length > 0) {
        const sample = rows[0];
        const cols = Object.keys(sample);
        if (cols.length > 0) {
          const placeholders = cols.map(() => '?').join(', ');
          const sql = `INSERT OR REPLACE INTO ${t} (${cols.join(', ')}) VALUES (${placeholders})`;
          const stmt = db.prepare(sql);
          for (const r of rows) {
            stmt.run(...cols.map(c => r[c]));
          }
        }
      }
    }
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('COMMIT');
  } catch (err) {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('ROLLBACK');
    throw err;
  }
  recordAudit(req.user?.id ?? null, 'استعادة نسخة احتياطية', 'system', null, {});
  res.json({ message: 'تمت استعادة كافة البيانات والنسخة الاحتياطية بنجاح' });
}));

const clientDist = resolve('dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      res.sendFile(resolve(clientDist, 'index.html'));
      return;
    }
    next();
  });
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof z.ZodError) { res.status(400).json({ message: 'يرجى مراجعة البيانات المدخلة', errors: error.issues }); return; }
  if (error instanceof BusinessError) { res.status(error.statusCode).json({ message: error.message }); return; }
  console.error(error);
  res.status(500).json({ message: 'حدث خطأ غير متوقع في الخادم' });
});

app.listen(port, host, () => console.log(`Vet Clinic API listening on http://${host}:${port}`));
