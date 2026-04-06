-- Clean up test custom items created during development
-- Run this in your Supabase SQL Editor

-- Delete all custom income items (is_custom = true)
DELETE FROM payout_income_items WHERE is_custom = true;

-- Delete all custom expense items (is_custom = true)
DELETE FROM payout_expense_items WHERE is_custom = true;

-- Verify cleanup
SELECT 'payout_income_items' as table_name, COUNT(*) as remaining FROM payout_income_items
UNION ALL
SELECT 'payout_expense_items', COUNT(*) FROM payout_expense_items;
