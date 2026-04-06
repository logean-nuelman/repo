export interface Profile {
  id: string;
  full_name: string | null;
  created_at: string;
}

export interface Projection {
  id: string;
  user_id: string;
  name: string;
  start_date: string;
  payout_frequency_days: number;
  created_at: string;
}

export interface PayoutDate {
  id: string;
  projection_id: string;
  month_number: number;
  payout_number: number;
  payout_date: string;
  created_at: string;
}

export interface IncomeItem {
  id: string;
  projection_id: string;
  label: string;
  amount: number;
  effective_date: string;
  created_at: string;
}

export interface ExpenseItem {
  id: string;
  projection_id: string;
  label: string;
  amount: number;
  effective_date: string;
  created_at: string;
}

export interface PayoutIncomeItem {
  id: string;
  payout_date_id: string;
  label: string;
  amount: number;
  is_custom: boolean;
}

export interface PayoutExpenseItem {
  id: string;
  payout_date_id: string;
  label: string;
  amount: number;
  is_custom: boolean;
}

export interface PayoutData {
  payoutDate: PayoutDate;
  incomeItems: PayoutIncomeItem[];
  expenseItems: PayoutExpenseItem[];
  totalIncome: number;
  totalExpenses: number;
  remaining: number;
}

export interface MonthData {
  monthNumber: number;
  monthName: string;
  year: number;
  payouts: PayoutData[];
  totalIncome: number;
  totalExpenses: number;
  totalRemaining: number;
}
