-- Migration: Add Vendor Ledger Schema and Enhancements
-- Purpose: Support new vendor ledger feature with comprehensive financial tracking
-- Date: 2026-05-06

-- Ensure vendors table has all required columns for ledger view
ALTER TABLE vendors
ADD COLUMN IF NOT EXISTS vendor_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS pan VARCHAR(10),
ADD COLUMN IF NOT EXISTS gstin VARCHAR(15),
ADD COLUMN IF NOT EXISTS contact_person VARCHAR(255);

-- Ensure bills table has all required columns
ALTER TABLE bills
ADD COLUMN IF NOT EXISTS invoice_number VARCHAR(100),
ADD COLUMN IF NOT EXISTS billing_period_start DATE,
ADD COLUMN IF NOT EXISTS billing_period_end DATE,
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id),
ADD COLUMN IF NOT EXISTS amount DECIMAL(15, 2),
ADD COLUMN IF NOT EXISTS status VARCHAR(50),
ADD COLUMN IF NOT EXISTS order_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS anomaly_flags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS due_date DATE;

-- Ensure payments table exists with proper structure
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  amount_paid DECIMAL(15, 2) NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE NOT NULL,
  payment_mode VARCHAR(50),
  utr_or_cheque_number VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure credit_notes table exists with proper structure
CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  cn_number VARCHAR(100) NOT NULL,
  date DATE NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  reason TEXT,
  linked_bill_id UUID REFERENCES bills(id),
  status VARCHAR(50) DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bills_vendor_id ON bills(vendor_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_created_at ON bills(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_vendor_id ON payments(vendor_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_credit_notes_vendor_id ON credit_notes(vendor_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_date ON credit_notes(date);

-- Enable RLS for payment security
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies if they don't exist
DO $$
BEGIN
  -- Payments policy for authenticated users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Enable read for authenticated users'
  ) THEN
    CREATE POLICY "Enable read for authenticated users" ON payments
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  -- Payments policy for authenticated insert
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Enable insert for authenticated users'
  ) THEN
    CREATE POLICY "Enable insert for authenticated users" ON payments
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;

  -- Credit notes policy for authenticated users
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'credit_notes' AND policyname = 'Enable read for authenticated users'
  ) THEN
    CREATE POLICY "Enable read for authenticated users" ON credit_notes
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;

  -- Credit notes policy for authenticated insert
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'credit_notes' AND policyname = 'Enable insert for authenticated users'
  ) THEN
    CREATE POLICY "Enable insert for authenticated users" ON credit_notes
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;
