import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Create Users
  const adminPassword = await argon2.hash('admin123');
  const vetPassword = await argon2.hash('vet123');
  const recPassword = await argon2.hash('rec123');
  const accPassword = await argon2.hash('acc123');

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      fullName: 'مدير النظام',
      username: 'admin',
      passwordHash: adminPassword,
      role: 'ADMIN',
    },
  });

  const vet = await prisma.user.upsert({
    where: { username: 'dr_ahmed' },
    update: {},
    create: {
      fullName: 'د. أحمد علي (طبيب بيطري)',
      username: 'dr_ahmed',
      passwordHash: vetPassword,
      role: 'VET',
    },
  });

  const receptionist = await prisma.user.upsert({
    where: { username: 'reception' },
    update: {},
    create: {
      fullName: 'منى محمود (استقبال)',
      username: 'reception',
      passwordHash: recPassword,
      role: 'RECEPTIONIST',
    },
  });

  const accountant = await prisma.user.upsert({
    where: { username: 'accountant' },
    update: {},
    create: {
      fullName: 'سامح حسن (محاسب)',
      username: 'accountant',
      passwordHash: accPassword,
      role: 'ACCOUNTANT',
    },
  });

  console.log('✅ Users created.');

  // 2. Create Breeds (Cats and Dogs only)
  const catBreeds = [
    { nameAr: 'شيرازي (Persian)', nameEn: 'Persian' },
    { nameAr: 'سيامي (Siamese)', nameEn: 'Siamese' },
    { nameAr: 'بريطاني قصير الشعر (British Shorthair)', nameEn: 'British Shorthair' },
    { nameAr: 'ماين كون (Maine Coon)', nameEn: 'Maine Coon' },
    { nameAr: 'سكوتش فولد (Scottish Fold)', nameEn: 'Scottish Fold' },
    { nameAr: 'راغدول (Ragdoll)', nameEn: 'Ragdoll' },
    { nameAr: 'ماو مصري (Egyptian Mau)', nameEn: 'Egyptian Mau' },
    { nameAr: 'سفينكس (Sphynx)', nameEn: 'Sphynx' },
    { nameAr: 'بلدي / هجين (Cat Mix)', nameEn: 'Mixed' },
  ];

  for (const b of catBreeds) {
    await prisma.breed.upsert({
      where: { species_nameAr: { species: 'CAT', nameAr: b.nameAr } },
      update: {},
      create: { species: 'CAT', nameAr: b.nameAr, nameEn: b.nameEn },
    });
  }

  const dogBreeds = [
    { nameAr: 'جولدن ريتريفر (Golden Retriever)', nameEn: 'Golden Retriever' },
    { nameAr: 'جيرمن شبرد (German Shepherd)', nameEn: 'German Shepherd' },
    { nameAr: 'لابرادور ريتريفر (Labrador Retriever)', nameEn: 'Labrador Retriever' },
    { nameAr: 'بودل (Poodle)', nameEn: 'Poodle' },
    { nameAr: 'هاسكي سيبيري (Siberian Husky)', nameEn: 'Husky' },
    { nameAr: 'روتوايلر (Rottweiler)', nameEn: 'Rottweiler' },
    { nameAr: 'بيتبول (Pitbull)', nameEn: 'Pitbull' },
    { nameAr: 'شيتزو (Shih Tzu)', nameEn: 'Shih Tzu' },
    { nameAr: 'بلدي / هجين (Dog Mix)', nameEn: 'Mixed' },
  ];

  for (const b of dogBreeds) {
    await prisma.breed.upsert({
      where: { species_nameAr: { species: 'DOG', nameAr: b.nameAr } },
      update: {},
      create: { species: 'DOG', nameAr: b.nameAr, nameEn: b.nameEn },
    });
  }

  console.log('✅ Cat and Dog Breeds created.');

  // 3. Create Vaccines (CAT & DOG isolated)
  const catVaccines = [
    { name: 'التطعيم الثلاثي للقطط (Tricat HCP)', species: 'CAT', manufacturer: 'MSD Animal Health', batchNo: 'CAT-TRI-2026', expiryDate: new Date('2027-12-31'), stockQty: 45, price: 350 },
    { name: 'التطعيم الرباعي للقطط (Quadricat)', species: 'CAT', manufacturer: 'Boehringer Ingelheim', batchNo: 'CAT-QUAD-2026', expiryDate: new Date('2027-10-15'), stockQty: 30, price: 450 },
    { name: 'تطعيم السعار للقطط (Rabies Cat)', species: 'CAT', manufacturer: 'Zoetis', batchNo: 'CAT-RAB-2026', expiryDate: new Date('2028-05-01'), stockQty: 50, price: 250 },
  ];

  for (const v of catVaccines) {
    await prisma.vaccine.create({ data: v });
  }

  const dogVaccines = [
    { name: 'التطعيم السباعي/الثماني للكلاب (DHPPi+L)', species: 'DOG', manufacturer: 'MSD Animal Health', batchNo: 'DOG-OCT-2026', expiryDate: new Date('2027-11-20'), stockQty: 40, price: 400 },
    { name: 'تطعيم السعار للكلاب (Rabies Dog)', species: 'DOG', manufacturer: 'Zoetis', batchNo: 'DOG-RAB-2026', expiryDate: new Date('2028-06-30'), stockQty: 60, price: 250 },
    { name: 'تطعيم سعال الوجار للكلاب (Kennel Cough)', species: 'DOG', manufacturer: 'Boehringer Ingelheim', batchNo: 'DOG-KC-2026', expiryDate: new Date('2027-08-10'), stockQty: 25, price: 300 },
  ];

  for (const v of dogVaccines) {
    await prisma.vaccine.create({ data: v });
  }

  console.log('✅ Vaccines catalog created.');

  // 4. Create Suppliers & Products
  const supplier1 = await prisma.supplier.create({
    data: {
      name: 'شركة الأمل للمستلزمات الطبية والبيطرية',
      contactPerson: 'م. خالد النجار',
      phone: '01001234567',
      email: 'info@alamal-vet.com',
      address: 'القاهرة - مدينة نصر',
    },
  });

  const products = [
    { sku: 'MED-AMOX-50', name: 'أموكسايسيلين 50 ملجم (أقراص)', category: 'MEDICINE', unit: 'شريط', costPrice: 40, sellPrice: 65, stockQty: 100, reorderLevel: 20, supplierId: supplier1.id },
    { sku: 'MED-SIMP-DOG', name: 'سيمباريكا للكلاب (حماية الحشرات والقراد)', category: 'MEDICINE', unit: 'علبة', costPrice: 200, sellPrice: 280, stockQty: 30, reorderLevel: 10, supplierId: supplier1.id },
    { sku: 'MED-BROAD-CAT', name: 'برودلاين قطط (مكافحة طفيليات)', category: 'MEDICINE', unit: 'أنبوبة', costPrice: 180, sellPrice: 250, stockQty: 25, reorderLevel: 8, supplierId: supplier1.id },
    { sku: 'CON-SYR-3ML', name: 'حقن معقمة 3 مل', category: 'CONSUMABLE', unit: 'علبة 100 حقنة', costPrice: 80, sellPrice: 120, stockQty: 50, reorderLevel: 15, supplierId: supplier1.id },
    { sku: 'SRV-CONSULT', name: 'كشف طبـي عام وخطة علاجية', category: 'SERVICE', unit: 'خدمة', costPrice: 0, sellPrice: 200, stockQty: 9999, reorderLevel: 0 },
    { sku: 'SRV-DENTAL', name: 'تنظيف وتلميع أسنان', category: 'SERVICE', unit: 'خدمة', costPrice: 100, sellPrice: 450, stockQty: 9999, reorderLevel: 0 },
  ];

  for (const p of products) {
    await prisma.product.create({ data: p });
  }

  console.log('✅ Products & Inventory created.');

  // 5. Create Demo Owners and Pets
  const owner1 = await prisma.owner.create({
    data: {
      fullName: 'محمد عبد الله الشريف',
      phone: '01011112222',
      altPhone: '01222223333',
      email: 'mohamed.elsharif@gmail.com',
      address: 'القاهرة - المعادي - شارع 9',
      nationalId: '29201011234567',
      notes: 'عميل مميز - يلتزم بمواعيد التطعيم',
      balance: 0,
    },
  });

  const owner2 = await prisma.owner.create({
    data: {
      fullName: 'سارة أحمد كمال',
      phone: '01144445555',
      email: 'sara.kamal@yahoo.com',
      address: 'الجيزة - الدقي',
      notes: 'لديه قطة وكلب',
      balance: 0,
    },
  });

  const persianCatBreed = await prisma.breed.findFirst({ where: { nameEn: 'Persian' } });
  const goldenDogBreed = await prisma.breed.findFirst({ where: { nameEn: 'Golden Retriever' } });
  const huskyDogBreed = await prisma.breed.findFirst({ where: { nameEn: 'Husky' } });

  const pet1 = await prisma.pet.create({
    data: {
      ownerId: owner1.id,
      name: 'لوسي',
      species: 'CAT',
      breedId: persianCatBreed?.id,
      sex: 'FEMALE',
      birthDate: new Date('2023-05-10'),
      color: 'أبيض مشمشي',
      weight: 3.8,
      microchip: '985141001234567',
      isNeutered: true,
      allergies: 'حساسية من أطعمة الأسماك المجففة',
      chronicDiseases: 'لا يوجد',
      diet: 'Royal Canin Mother & Babycat',
    },
  });

  const pet2 = await prisma.pet.create({
    data: {
      ownerId: owner2.id,
      name: 'ماكس',
      species: 'DOG',
      breedId: goldenDogBreed?.id,
      sex: 'MALE',
      birthDate: new Date('2022-01-15'),
      color: 'ذهبي فاتح',
      weight: 28.5,
      microchip: '985141007654321',
      isNeutered: false,
      allergies: 'لا يوجد',
      chronicDiseases: 'لا يوجد',
      diet: 'Purina Pro Plan Adult',
    },
  });

  const pet3 = await prisma.pet.create({
    data: {
      ownerId: owner2.id,
      name: 'سيمبا',
      species: 'DOG',
      breedId: huskyDogBreed?.id,
      sex: 'MALE',
      birthDate: new Date('2024-03-01'),
      color: 'أسود وأبيض',
      weight: 16.2,
      isNeutered: false,
    },
  });

  console.log('✅ Owners & Pets created.');

  // 6. Create Demo Appointments & Visits
  const appointment1 = await prisma.appointment.create({
    data: {
      petId: pet1.id,
      vetId: vet.id,
      startsAt: new Date(Date.now() + 24 * 3600 * 1000), // tomorrow
      durationMin: 30,
      type: 'EXAM',
      status: 'CONFIRMED',
      notes: 'كشف دوري ومتابعة الوزن',
    },
  });

  const visit1 = await prisma.visit.create({
    data: {
      petId: pet1.id,
      vetId: vet.id,
      chiefComplaint: 'فقدان شهية بسيط منذ يومين ورغبة في النوم المستمر',
      history: 'تأكل طعام جاف فقط، آخر تطعيم قبل 6 أشهر',
      temperature: 38.6,
      weight: 3.8,
      heartRate: 140,
      respRate: 26,
      crt: '< 2 sec',
      physicalExam: 'الأذن والعيون سليمة، الفم نقي بدون تقرحات، البطن مرن ولا توجد آلام عند اللمس',
      diagnosis: 'عسر هضم خفيف نتيجة تغيير نوع الطعام',
      plan: 'إعطاء فاتح شهية ومطهر معوي مدة 5 أيام مع التوصية بتناول طعام رطب طري',
      status: 'COMPLETED',
    },
  });

  await prisma.prescription.create({
    data: {
      visitId: visit1.id,
      medicine: 'أموكسايسيلين 50 ملجم',
      dosage: 'نصف قرص (25 ملجم)',
      frequency: 'مرتان يومياً بعد الأكل',
      durationDays: 5,
      instructions: 'يخلط مع قليل من الطعام الرطب',
    },
  });

  // Vaccination record
  const catVaccine = await prisma.vaccine.findFirst({ where: { species: 'CAT' } });
  if (catVaccine) {
    await prisma.vaccination.create({
      data: {
        petId: pet1.id,
        vaccineId: catVaccine.id,
        givenByVetId: vet.id,
        givenAt: new Date('2026-02-01'),
        nextDueAt: new Date('2027-02-01'),
        doseNumber: 1,
        certificateNo: 'VACC-CAT-2026-001',
      },
    });
  }

  // Invoice demo
  const invoice1 = await prisma.invoice.create({
    data: {
      invoiceNo: 'INV-2026-0001',
      ownerId: owner1.id,
      petId: pet1.id,
      subtotal: 265,
      discount: 15,
      tax: 0,
      total: 250,
      paid: 250,
      status: 'PAID',
      createdById: receptionist.id,
      items: {
        create: [
          { description: 'كشف طبي عام وخطة علاجية', quantity: 1, unitPrice: 200, total: 200 },
          { description: 'أموكسايسيلين 50 ملجم (أقراص)', quantity: 1, unitPrice: 65, total: 65 },
        ],
      },
    },
  });

  await prisma.payment.create({
    data: {
      invoiceId: invoice1.id,
      ownerId: owner1.id,
      amount: 250,
      method: 'CASH',
      createdById: receptionist.id,
      notes: 'سداد نقدي بالكامل بالاستقبال',
    },
  });

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
