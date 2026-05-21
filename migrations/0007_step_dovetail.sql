-- Add Dovetail Copilot intent trigger to steps
ALTER TABLE steps ADD COLUMN dovetail_intent TEXT DEFAULT NULL;
