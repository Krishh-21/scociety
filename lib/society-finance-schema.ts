export const SOCIETY_FINANCE_SCHEMA = `
CREATE TABLE IF NOT EXISTS society_finance_bills (
  id TEXT PRIMARY KEY,
  societyId TEXT NOT NULL REFERENCES society(id),
  flat TEXT NOT NULL,
  month TEXT NOT NULL,
  dueOn TEXT NOT NULL,
  totalPaise INTEGER NOT NULL CHECK (totalPaise > 0),
  issuedBy TEXT NOT NULL REFERENCES user(id),
  issuedAt TEXT NOT NULL,
  lastReminderOn TEXT,
  UNIQUE (societyId, flat, month)
);

CREATE INDEX IF NOT EXISTS idx_society_finance_bill_month ON society_finance_bills(societyId, month, flat);

CREATE TABLE IF NOT EXISTS society_finance_bill_items (
  billId TEXT NOT NULL REFERENCES society_finance_bills(id),
  position INTEGER NOT NULL,
  label TEXT NOT NULL,
  amountPaise INTEGER NOT NULL CHECK (amountPaise > 0),
  PRIMARY KEY (billId, position)
);

CREATE TABLE IF NOT EXISTS society_finance_payments (
  id TEXT PRIMARY KEY,
  billId TEXT NOT NULL UNIQUE REFERENCES society_finance_bills(id),
  amountPaise INTEGER NOT NULL CHECK (amountPaise > 0),
  method TEXT NOT NULL CHECK (method IN ('upi', 'bank_transfer', 'cash', 'cheque')),
  reference TEXT NOT NULL,
  paidOn TEXT NOT NULL,
  recordedBy TEXT NOT NULL REFERENCES user(id),
  recordedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS society_finance_expenses (
  id TEXT PRIMARY KEY,
  societyId TEXT NOT NULL REFERENCES society(id),
  kind TEXT NOT NULL CHECK (kind IN ('expense', 'vendor_bill')),
  label TEXT NOT NULL,
  category TEXT NOT NULL,
  vendor TEXT NOT NULL COLLATE NOCASE,
  invoiceReference TEXT COLLATE NOCASE,
  amountPaise INTEGER NOT NULL CHECK (amountPaise > 0),
  incurredOn TEXT NOT NULL,
  dueOn TEXT,
  paidOn TEXT,
  paymentReference TEXT COLLATE NOCASE,
  createdBy TEXT NOT NULL REFERENCES user(id),
  createdAt TEXT NOT NULL,
  paidBy TEXT REFERENCES user(id),
  CHECK ((paidOn IS NULL AND paymentReference IS NULL AND paidBy IS NULL)
      OR (paidOn IS NOT NULL AND paymentReference IS NOT NULL AND paidBy IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_society_finance_expense_date ON society_finance_expenses(societyId, incurredOn);
CREATE UNIQUE INDEX IF NOT EXISTS idx_society_finance_vendor_invoice
  ON society_finance_expenses(societyId, vendor, invoiceReference) WHERE kind = 'vendor_bill';
CREATE UNIQUE INDEX IF NOT EXISTS idx_society_finance_direct_expense
  ON society_finance_expenses(societyId, label, vendor, amountPaise, incurredOn, paymentReference) WHERE kind = 'expense';

CREATE TABLE IF NOT EXISTS society_finance_expense_receipts (
  expenseId TEXT PRIMARY KEY REFERENCES society_finance_expenses(id) ON DELETE CASCADE,
  contentType TEXT NOT NULL CHECK (contentType IN ('image/jpeg', 'image/png')),
  bytes BLOB NOT NULL CHECK (length(bytes) BETWEEN 1 AND 750000)
);

CREATE TABLE IF NOT EXISTS society_finance_bank_balances (
  societyId TEXT NOT NULL REFERENCES society(id),
  reportedOn TEXT NOT NULL,
  amountPaise INTEGER NOT NULL,
  reportedBy TEXT NOT NULL REFERENCES user(id),
  recordedAt TEXT NOT NULL,
  PRIMARY KEY (societyId, reportedOn)
);
`;
