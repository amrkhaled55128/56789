export type Role = 'ADMIN' | 'VET' | 'RECEPTIONIST' | 'ACCOUNTANT';
export type Species = 'CAT' | 'DOG';
export type Sex = 'MALE' | 'FEMALE';

export type AppointmentType =
  | 'EXAM'
  | 'VACCINE'
  | 'SURGERY'
  | 'FOLLOWUP'
  | 'EMERGENCY'
  | 'LAB'
  | 'DENTAL'
  | 'GROOMING';

export type AppointmentStatus =
  | 'SCHEDULED'
  | 'CONFIRMED'
  | 'ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export type VisitStatus = 'OPEN' | 'COMPLETED';
export type LabStatus = 'REQUESTED' | 'PENDING' | 'COMPLETED' | 'CANCELLED';
export type StockType = 'IN' | 'OUT' | 'ADJUST';
export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'CANCELLED';
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK_TRANSFER';
