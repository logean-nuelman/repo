import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'
import { Plus, Trash2, ArrowRight, ArrowLeft } from 'lucide-react'

interface IncomeItem {
  id: string
  label: string
  amount: string
  effectiveDate: string
}

interface ExpenseItem {
  id: string
  label: string
  amount: string
  effectiveDate: string
}

export default function Setup() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [frequency, setFrequency] = useState(14)
  const [incomeItems, setIncomeItems] = useState<IncomeItem[]>([
    { id: '1', label: '', amount: '', effectiveDate: '' }
  ])
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([
    { id: '1', label: '', amount: '', effectiveDate: '' }
  ])
  const [loading, setLoading] = useState(false)

  const addIncomeItem = () => {
    setIncomeItems([...incomeItems, { id: Date.now().toString(), label: '', amount: '', effectiveDate: startDate }])
  }

  const removeIncomeItem = (id: string) => {
    if (incomeItems.length > 1) {
      setIncomeItems(incomeItems.filter(item => item.id !== id))
    }
  }

  const updateIncomeItem = (id: string, field: keyof IncomeItem, value: string) => {
    setIncomeItems(incomeItems.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  const addExpenseItem = () => {
    setExpenseItems([...expenseItems, { id: Date.now().toString(), label: '', amount: '', effectiveDate: startDate }])
  }

  const removeExpenseItem = (id: string) => {
    if (expenseItems.length > 1) {
      setExpenseItems(expenseItems.filter(item => item.id !== id))
    }
  }

  const updateExpenseItem = (id: string, field: keyof ExpenseItem, value: string) => {
    setExpenseItems(expenseItems.map(item => item.id === id ? { ...item, [field]: value } : item))
  }

  const generatePayoutDates = (start: Date, freq: number) => {
    const dates: { month_number: number; payout_number: number; payout_date: string }[] = []
    let currentDate = new Date(start)
    let monthMap = new Map<string, number>()

    for (let i = 0; i < 36; i++) {
      const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, monthMap.size + 1)
      }
      const monthNumber = monthMap.get(monthKey)!

      dates.push({
        month_number: monthNumber,
        payout_number: i + 1,
        payout_date: format(currentDate, 'yyyy-MM-dd')
      })

      currentDate = addDays(currentDate, freq)
    }
    return dates
  }

  const handleFinish = async () => {
    if (!user) return
    setLoading(true)

    try {
      // Create projection
      const { data: projection, error: projError } = await supabase
        .from('projections')
        .insert({
          user_id: user.id,
          start_date: startDate,
          payout_frequency_days: frequency
        })
        .select()
        .single()

      if (projError) throw projError

      // Generate payout dates
      const payoutDates = generatePayoutDates(new Date(startDate), frequency)
      const { error: datesError } = await supabase
        .from('payout_dates')
        .insert(payoutDates.map(d => ({ ...d, projection_id: projection.id })))

      if (datesError) throw datesError

      // Insert income items
      const validIncomeItems = incomeItems.filter(item => item.label && item.amount)
      if (validIncomeItems.length > 0) {
        const { error: incomeError } = await supabase
          .from('income_items')
          .insert(validIncomeItems.map(item => ({
            projection_id: projection.id,
            label: item.label,
            amount: parseFloat(item.amount),
            effective_date: item.effectiveDate
          })))
        if (incomeError) throw incomeError
      }

      // Insert expense items
      const validExpenseItems = expenseItems.filter(item => item.label && item.amount)
      if (validExpenseItems.length > 0) {
        const { error: expenseError } = await supabase
          .from('expense_items')
          .insert(validExpenseItems.map(item => ({
            projection_id: projection.id,
            label: item.label,
            amount: parseFloat(item.amount),
            effective_date: item.effectiveDate
          })))
        if (expenseError) throw expenseError
      }

      toast.success('Projection created successfully!')
      navigate('/')
    } catch (error: any) {
      toast.error(error.message || 'Failed to create projection')
    } finally {
      setLoading(false)
    }
  }

  const previewDates = generatePayoutDates(new Date(startDate), frequency).slice(0, 6)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Step {step} of 3</span>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                {step === 1 ? 'Payout Schedule' : step === 2 ? 'Income Items' : 'Expense Items'}
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all"
                style={{ width: `${(step / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Step 1: Payout Schedule */}
          {step === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Configure Payout Schedule
              </h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Payout Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Days Between Payouts
                </label>
                <input
                  type="number"
                  value={frequency}
                  onChange={(e) => setFrequency(parseInt(e.target.value))}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Preview:</p>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-1">
                  {previewDates.map((d, i) => (
                    <div key={i} className="text-sm text-gray-600 dark:text-gray-300">
                      Payout {d.payout_number}: {format(new Date(d.payout_date), 'MMMM d, yyyy')}
                    </div>
                  ))}
                  <div className="text-sm text-gray-400 dark:text-gray-500">...and more</div>
                </div>
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full flex items-center justify-center py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Continue <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          )}

          {/* Step 2: Income Items */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Add Income Items
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                These items will be auto-applied to payouts on or after the effective date.
              </p>
              {incomeItems.map((item) => (
                <div key={item.id} className="flex gap-2 items-start">
                  <input
                    type="text"
                    placeholder="Label (e.g. Salary)"
                    value={item.label}
                    onChange={(e) => updateIncomeItem(item.id, 'label', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={item.amount}
                    onChange={(e) => updateIncomeItem(item.id, 'amount', e.target.value)}
                    className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <input
                    type="date"
                    value={item.effectiveDate}
                    onChange={(e) => updateIncomeItem(item.id, 'effectiveDate', e.target.value)}
                    className="w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={() => removeIncomeItem(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addIncomeItem}
                className="flex items-center text-sm text-blue-600 hover:text-blue-500"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Income Item
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 flex items-center justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 flex items-center justify-center py-2 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Continue <ArrowRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Expense Items */}
          {step === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Add Expense Items
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                These items will be auto-applied to payouts on or after the effective date.
              </p>
              {expenseItems.map((item) => (
                <div key={item.id} className="flex gap-2 items-start">
                  <input
                    type="text"
                    placeholder="Label (e.g. Rent)"
                    value={item.label}
                    onChange={(e) => updateExpenseItem(item.id, 'label', e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={item.amount}
                    onChange={(e) => updateExpenseItem(item.id, 'amount', e.target.value)}
                    className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <input
                    type="date"
                    value={item.effectiveDate}
                    onChange={(e) => updateExpenseItem(item.id, 'effectiveDate', e.target.value)}
                    className="w-40 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={() => removeExpenseItem(item.id)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={addExpenseItem}
                className="flex items-center text-sm text-blue-600 hover:text-blue-500"
              >
                <Plus className="w-4 h-4 mr-1" /> Add Expense Item
              </button>
              <div className="flex gap-2">
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 flex items-center justify-center py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back
                </button>
                <button
                  onClick={handleFinish}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center py-2 px-4 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {loading ? 'Creating...' : 'Create Projection'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
