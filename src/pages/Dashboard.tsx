import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, Edit2 } from 'lucide-react'
import PayoutEditModal from '../components/PayoutEditModal'
import toast from 'react-hot-toast'

interface PayoutDate {
  id: string
  month_number: number
  payout_number: number
  payout_date: string
}

interface IncomeItem {
  id: string
  payout_date_id: string
  label: string
  amount: number
  is_custom: boolean
  is_removed: boolean
}

interface ExpenseItem {
  id: string
  payout_date_id: string
  label: string
  amount: number
  is_custom: boolean
  is_removed: boolean
}

interface GlobalIncomeItem {
  id: string
  label: string
  amount: number
  effective_date: string
}

interface GlobalExpenseItem {
  id: string
  label: string
  amount: number
  effective_date: string
}

interface MonthGroup {
  monthNumber: number
  monthName: string
  year: number
  payouts: {
    id: string
    date: string
    incomeItems: IncomeItem[]
    expenseItems: ExpenseItem[]
    totalIncome: number
    totalExpenses: number
    remaining: number
  }[]
}

export default function Dashboard() {
  const { user } = useAuth()
  const [projectionId, setProjectionId] = useState<string | null>(null)
  const [payoutDates, setPayoutDates] = useState<PayoutDate[]>([])
  const [globalIncomeItems, setGlobalIncomeItems] = useState<GlobalIncomeItem[]>([])
  const [globalExpenseItems, setGlobalExpenseItems] = useState<GlobalExpenseItem[]>([])
  const [payoutIncomeItems, setPayoutIncomeItems] = useState<IncomeItem[]>([])
  const [payoutExpenseItems, setPayoutExpenseItems] = useState<ExpenseItem[]>([])
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [editingPayout, setEditingPayout] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) fetchProjection()
  }, [user])

  const fetchProjection = async () => {
    if (!user) return
    const { data, error } = await supabase
      .from('projections')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (error || !data) {
      setLoading(false)
      return
    }

    setProjectionId(data.id)
    await Promise.all([
      fetchPayoutDates(data.id),
      fetchGlobalIncomeItems(data.id),
      fetchGlobalExpenseItems(data.id)
    ])
    setLoading(false)
  }

  const fetchPayoutDates = async (projId: string) => {
    const { data, error } = await supabase
      .from('payout_dates')
      .select('*')
      .eq('projection_id', projId)
      .order('payout_date', { ascending: true })

    if (!error && data) setPayoutDates(data)
  }

  const fetchGlobalIncomeItems = async (projId: string) => {
    const { data, error } = await supabase
      .from('income_items')
      .select('*')
      .eq('projection_id', projId)

    if (!error && data) setGlobalIncomeItems(data)
  }

  const fetchGlobalExpenseItems = async (projId: string) => {
    const { data, error } = await supabase
      .from('expense_items')
      .select('*')
      .eq('projection_id', projId)

    if (!error && data) setGlobalExpenseItems(data)
  }

  const fetchPayoutItems = useCallback(async () => {
    if (!projectionId) return
    const [incomeRes, expenseRes] = await Promise.all([
      supabase.from('payout_income_items').select('*'),
      supabase.from('payout_expense_items').select('*')
    ])
    if (incomeRes.data) setPayoutIncomeItems(incomeRes.data)
    if (expenseRes.data) setPayoutExpenseItems(expenseRes.data)
  }, [projectionId])

  useEffect(() => {
    if (projectionId) fetchPayoutItems()
  }, [projectionId, fetchPayoutItems])

  const getMonthData = useCallback((date: Date): MonthGroup | null => {
    if (!projectionId) return null

    const monthStart = startOfMonth(date)
    const monthEnd = endOfMonth(date)
    const monthPayouts = payoutDates.filter(pd => {
      const pdDate = parseISO(pd.payout_date)
      return pdDate >= monthStart && pdDate <= monthEnd
    })

    const payouts = monthPayouts.map(pd => {
      const applicableIncome = globalIncomeItems.filter(item =>
        parseISO(item.effective_date) <= parseISO(pd.payout_date)
      )
      const applicableExpense = globalExpenseItems.filter(item =>
        parseISO(item.effective_date) <= parseISO(pd.payout_date)
      )

      const customIncome = payoutIncomeItems.filter(i => i.payout_date_id === pd.id && !i.is_removed)
      const customExpense = payoutExpenseItems.filter(i => i.payout_date_id === pd.id && !i.is_removed)

      const removedIncomeIds = payoutIncomeItems.filter(i => i.payout_date_id === pd.id && i.is_removed).map(i => i.label)
      const removedExpenseIds = payoutExpenseItems.filter(i => i.payout_date_id === pd.id && i.is_removed).map(i => i.label)

      const finalIncome = [
        ...applicableIncome.filter(i => !removedIncomeIds.includes(i.label)).map(i => ({
          id: i.id,
          payout_date_id: pd.id,
          label: i.label,
          amount: i.amount,
          is_custom: false,
          is_removed: false
        })),
        ...customIncome.filter(i => i.is_custom)
      ]

      const finalExpenses = [
        ...applicableExpense.filter(i => !removedExpenseIds.includes(i.label)).map(i => ({
          id: i.id,
          payout_date_id: pd.id,
          label: i.label,
          amount: i.amount,
          is_custom: false,
          is_removed: false
        })),
        ...customExpense.filter(i => i.is_custom)
      ]

      // Override amounts with custom values
      const incomeItems = finalIncome.map(item => {
        const custom = customIncome.find(c => c.label === item.label && !c.is_custom)
        return custom ? { ...item, amount: custom.amount } : item
      })

      const expenseItems = finalExpenses.map(item => {
        const custom = customExpense.find(c => c.label === item.label && !c.is_custom)
        return custom ? { ...item, amount: custom.amount } : item
      })

      const totalIncome = incomeItems.reduce((sum, i) => sum + i.amount, 0)
      const totalExpenses = expenseItems.reduce((sum, i) => sum + i.amount, 0)

      return {
        id: pd.id,
        date: pd.payout_date,
        incomeItems,
        expenseItems,
        totalIncome,
        totalExpenses,
        remaining: totalIncome - totalExpenses
      }
    })

    return {
      monthNumber: date.getMonth() + 1,
      monthName: format(date, 'MMMM'),
      year: date.getFullYear(),
      payouts
    }
  }, [projectionId, payoutDates, globalIncomeItems, globalExpenseItems, payoutIncomeItems, payoutExpenseItems])

  const calendarDays = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  })

  const payoutDatesInMonth = payoutDates.filter(pd =>
    isSameMonth(parseISO(pd.payout_date), currentMonth)
  )

  const monthData = getMonthData(currentMonth)

  if (loading) {
    return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  }

  if (!projectionId) {
    return (
      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">No Projection Found</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-4">Please create a projection first.</p>
          <a href="/setup" className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Create Projection
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar Calendar */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 hidden lg:block overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="font-semibold text-gray-900 dark:text-white">{format(currentMonth, 'MMMM yyyy')}</h3>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-gray-500 dark:text-gray-400">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-sm">
          {calendarDays.map(day => {
            const hasPayout = payoutDatesInMonth.some(pd => isSameDay(parseISO(pd.payout_date), day))
            return (
              <div
                key={day.toString()}
                className={`p-1 rounded ${isSameMonth(day, currentMonth) ? 'text-gray-900 dark:text-white' : 'text-gray-300 dark:text-gray-600'} ${hasPayout ? 'bg-blue-100 dark:bg-blue-900/30 font-semibold' : ''}`}
              >
                {format(day, 'd')}
                {hasPayout && <div className="w-1 h-1 bg-blue-600 rounded-full mx-auto mt-0.5" />}
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {monthData && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {monthData.monthName} {monthData.year}
              </h2>
              <div className="flex gap-2">
                <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {monthData.payouts.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center text-gray-500 dark:text-gray-400">
                No payouts for this month
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {monthData.payouts.map(payout => (
                  <div key={payout.id} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {format(parseISO(payout.date), 'MMMM d, yyyy')}
                      </h3>
                      <button
                        onClick={() => setEditingPayout(payout.id)}
                        className="p-1 text-gray-500 hover:text-blue-500"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <p className="text-sm font-medium text-green-600 dark:text-green-400">Income</p>
                        {payout.incomeItems.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-300">+ {item.label}</span>
                            <span className="text-gray-900 dark:text-white">${item.amount.toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-medium border-t border-gray-200 dark:border-gray-700 pt-1">
                          <span className="text-green-600 dark:text-green-400">Total Income</span>
                          <span className="text-green-600 dark:text-green-400">${payout.totalIncome.toFixed(2)}</span>
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium text-red-600 dark:text-red-400">Expenses & Bills</p>
                        {payout.expenseItems.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-gray-600 dark:text-gray-300">- {item.label}</span>
                            <span className="text-gray-900 dark:text-white">${item.amount.toFixed(2)}</span>
                          </div>
                        ))}
                        <div className="flex justify-between text-sm font-medium border-t border-gray-200 dark:border-gray-700 pt-1">
                          <span className="text-red-600 dark:text-red-400">Total Expenses</span>
                          <span className="text-red-600 dark:text-red-400">${payout.totalExpenses.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="border-t border-gray-200 dark:border-gray-700 pt-2">
                        <div className="flex justify-between font-semibold">
                          <span className="text-gray-900 dark:text-white">Remaining</span>
                          <span className={payout.remaining >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                            ${payout.remaining.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingPayout && (
        <PayoutEditModal
          payoutId={editingPayout}
          onClose={() => setEditingPayout(null)}
          onSave={() => {
            fetchPayoutItems()
            setEditingPayout(null)
            toast.success('Payout updated')
          }}
        />
      )}
    </div>
  )
}
