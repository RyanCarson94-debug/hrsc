-- Add case reference number column to cases
ALTER TABLE cases ADD COLUMN case_ref TEXT NOT NULL DEFAULT '';
