export type Role = 'ADMIN' | 'VET' | 'RECEPTIONIST' | 'ACCOUNTANT';
export type Species = 'CAT' | 'DOG';
export type Sex = 'MALE' | 'FEMALE';

export interface User {
  id: string;
  fullName: string;
  username: string;
  role: Role;
  isActive?: boolean;
}

export interface Owner {
  id: string;
  fullName: string;
  phone: string;
  altPhone?: string;
  email?: string;
  address?: string;
  nationalId?: string;
  notes?: string;
  balance: number;
  pets?: Pet[];
  invoices?: Invoice[];
  createdAt?: string;
}

export interface Breed {
  id: string;
  species: Species;
  nameAr: string;
  nameEn: string;
}

export interface Pet {
  id: string;
  ownerId: string;
  name: string;
  species: Species;
  breedId?: string;
  sex: Sex;
  birthDate: string;
  color?: string;
  weight?: number;
  microchip?: string;
  isNeutered?: boolean;
  bloodType?: string;
  allergies?: string;
  chronicDiseases?: string;
  diet?: string;
  photoUrl?: string;
  owner?: Owner;
  breed?: Breed;
  visits?: Visit[];
  vaccinations?: Vaccination[];
  weightHistory?: { date: string; weight: number }[];
  createdAt?: string;
}

export interface Appointment {
  id: string;
  petId: string;
  vetId?: string;
  startsAt: string;
  durationMin: number;
  type: string;
  status: string;
  notes?: string;
  pet?: Pet;
  visit?: Visit;
  createdAt?: string;
}

export interface Prescription {
  id: string;
  visitId: string;
  medicine: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions?: string;
  createdAt?: string;
}

export interface Visit {
  id: string;
  petId: string;
  vetId: string;
  appointmentId?: string;
  chiefComplaint: string;
  history?: string;
  temperature?: number;
  weight?: number;
  heartRate?: number;
  respRate?: number;
  crt?: string;
  physicalExam?: string;
  diagnosis: string;
  plan: string;
  followUpAt?: string;
  status: string;
  pet?: Pet;
  vet?: User;
  prescriptions?: Prescription[];
  createdAt?: string;
}

export interface Vaccine {
  id: string;
  name: string;
  species: Species;
  manufacturer?: string;
  batchNo: string;
  expiryDate: string;
  stockQty: number;
  price: number;
}

export interface Vaccination {
  id: string;
  petId: string;
  vaccineId: string;
  givenByVetId: string;
  givenAt: string;
  nextDueAt?: string;
  doseNumber: number;
  certificateNo?: string;
  pet?: Pet;
  vaccine?: Vaccine;
  givenBy?: User;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  costPrice: number;
  sellPrice: number;
  stockQty: number;
  reorderLevel: number;
  expiryDate?: string;
  supplierId?: string;
}

export interface InvoiceItem {
  id?: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Payment {
  id: string;
  invoiceId: string;
  ownerId: string;
  amount: number;
  method: 'CASH' | 'CARD' | 'BANK_TRANSFER';
  notes?: string;
  createdById: string;
  createdAt?: string;
  createdBy?: User;
}

export interface Invoice {
  id: string;
  invoiceNo: string;
  ownerId: string;
  petId?: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  status: string;
  createdById: string;
  owner?: Owner;
  pet?: Pet;
  items?: InvoiceItem[];
  payments?: Payment[];
  createdAt?: string;
}

export interface AuditLog {
  id: string;
  userId?: string;
  action: string;
  entity: string;
  entityId?: string;
  beforeValue?: string;
  afterValue?: string;
  ipAddress?: string;
  createdAt: string;
  user?: User;
}
