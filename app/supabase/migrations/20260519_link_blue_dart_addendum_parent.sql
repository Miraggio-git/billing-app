-- Migration: Link Blue Dart Express Limited Addendum to parent vendor
-- Purpose: Set parent_vendor_id on the Addendum entry so it groups under
--          Blue Dart Express Limited in the vendor list UI (same as Delhivery 3PL)
-- Date: 2026-05-19

UPDATE vendors
SET parent_vendor_id = (
  SELECT id
  FROM vendors
  WHERE name = 'Blue Dart Express Limited'
    AND parent_vendor_id IS NULL
  LIMIT 1
)
WHERE name = 'Blue Dart Express Limited Addendum'
  AND parent_vendor_id IS NULL;
