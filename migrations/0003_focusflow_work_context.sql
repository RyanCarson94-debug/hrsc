-- Migration: 0003_focusflow_work_context
-- Adds work_context field to store user's role, tools, and systems context
-- for AI-powered task breakdown

ALTER TABLE focusflow_users ADD COLUMN work_context TEXT;
