import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { formatCurrency } from '../lib/format'
import { Trash2, X, Save } from 'lucide-react'
import { parseISO } from 'date-fns'

interface PayoutEditModalProps {
  payoutId: string
  onClose: () => void
  onSave: () => void
}

interface GlobalItem {
  id: string
  label: string
  amount: number
  effective_date: string
}

interface PayoutItem {
  id: string
  label: string
  amount: number
  is_custom: boolean
  is_removed: boolean
}

export default function PayoutEditModal({ payoutId, onClose, onSave }: PayoutEditModalProps) {
  const [payoutDate, setPayoutDate] = useState<string | null>(null)
  const [_projectionId, setProjectionId] = useState<string | null>(null)
  const [globalIncomeItems, setGlobalIncomeItems] = useState<GlobalItem[]>([])
  const [globalExpenseItems, setGlobalExpenseItems] = useState<GlobalItem[]>([])
  const [customIncomeItems, setCustomIncomeItems] = useState<PayoutItem[]>([])
  const [customExpenseItems, setCustomExpenseItems] = useState<PayoutItem[]>([])
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchPayoutData()
  }, [payoutId])

  const fetchPayoutData = async () => {
    console.log('Fetching payout data for:', payoutId)
    // Get payout date and projection_id
    const { data: payoutDateData, error: payoutError } = await supabase
      .from('payout_dates')
      .select('payout_date, projection_id')
      .eq('id', payoutId)
      .single()

    if (payoutError) {
      console.error('Error fetching payout date:', payoutError)
      setLoading(false)
      return
    }

    if (!payoutDateData) {
      console.log('No payout date found')
      setLoading(false)
      return
    }

    console.log('Payout date found:', payoutDateData)
    setPayoutDate(payoutDateData.payout_date)
    setProjectionId(payoutDateData.projection_id)

    // Fetch global items
    const [incomeRes, expenseRes] = await Promise.all([
      supabase.from('income_items').select('*').eq('projection_id', payoutDateData.projection_id),
      supabase.from('expense_items').select('*').eq('projection_id', payoutDateData.projection_id)
    ])

    console.log('Global income items:', incomeRes)
    console.log('Global expense items:', expenseRes)

    if (incomeRes.data) setGlobalIncomeItems(incomeRes.data)
    if (expenseRes.data) setGlobalExpenseItems(expenseRes.data)

    // Fetch custom items
    const [customIncomeRes, customExpenseRes] = await Promise.all([
      supabase.from('payout_income_items').select('*').eq('payout_date_id', payoutId),
      supabase.from('payout_expense_items').select('*').eq('payout_date_id', payoutId)
    ])

    console.log('Custom income items:', customIncomeRes)
    console.log('Custom expense items:', customExpenseRes)

    if (customIncomeRes.data) setCustomIncomeItems(customIncomeRes.data)
    if (customExpenseRes.data) setCustomExpenseItems(customExpenseRes.data)

    setLoading(false)
  }

  const getApplicableGlobalItems = (globalItems: GlobalItem[]) => {
    if (!payoutDate) return []
    return globalItems.filter(item => parseISO(item.effective_date) <= parseISO(payoutDate))
  }

  const isItemRemoved = (label: string, customItems: PayoutItem[]) => {
    return customItems.some(i => i.label === label && i.is_removed)
  }

  const getCustomAmount = (label: string, customItems: PayoutItem[]) => {
    const custom = customItems.find(i => i.label === label && !i.is_custom)
    return custom ? custom.amount : null
  }

  const toggleIncomeItem = (label: string) => {
    const existing = customIncomeItems.find(i => i.label === label)
    if (existing) {
      setCustomIncomeItems(customIncomeItems.map(i =>
        i.id === existing.id ? { ...i, is_removed: !i.is_removed } : i
      ))
    } else {
      setCustomIncomeItems([...customIncomeItems, {
        id: `temp-income-${Date.now()}`,
        label,
        amount: globalIncomeItems.find(i => i.label === label)?.amount || 0,
        is_custom: false,
        is_removed: false
      }])
    }
  }

  const toggleExpenseItem = (label: string) => {
    const existing = customExpenseItems.find(i => i.label === label)
    if (existing) {
      setCustomExpenseItems(customExpenseItems.map(i =>
        i.id === existing.id ? { ...i, is_removed: !i.is_removed } : i
      ))
    } else {
      setCustomExpenseItems([...customExpenseItems, {
        id: `temp-expense-${Date.now()}`,
        label,
        amount: globalExpenseItems.find(i => i.label === label)?.amount || 0,
        is_custom: false,
        is_removed: false
      }])
    }
  }

  const addCustomIncomeItem = () => {
    setCustomIncomeItems([...customIncomeItems, {
      id: `temp-income-${Date.now()}`,
      label: 'New Income',
      amount: 0,
      is_custom: true,
      is_removed: false
    }])
  }

  const addCustomExpenseItem = () => {
    setCustomExpenseItems([...customExpenseItems, {
      id: `temp-expense-${Date.now()}`,
      label: 'New Expense',
      amount: 0,
      is_custom: true,
      is_removed: false
    }])
  }

  const removeCustomItem = (type: 'income' | 'expense', id: string) => {
    if (type === 'income') {
      setCustomIncomeItems(customIncomeItems.filter(i => i.id !== id))
    } else {
      setCustomExpenseItems(customExpenseItems.filter(i => i.id !== id))
    }
  }

  const updateItemAmount = (_type: 'income' | 'expense', id: string, amount: string) => {
    setEditForm({ ...editForm, [id]: amount })
  }

  const updateItemLabel = (_type: 'income' | 'expense', id: string, label: string) => {
    setEditForm({ ...editForm, [id]: label })
  }

  const handleSave = async () => {
    if (!payoutId) return
    setSaving(true)

    try {
      // Save edited global income item amounts
      for (const item of applicableIncome) {
        const editKey = `income-${item.id}`
        const amount = parseFloat(editForm[editKey] ?? String(item.amount)) || item.amount
        const removed = isItemRemoved(item.label, customIncomeItems)
        // Check if there's already a DB record (not a temp ID)
        const existing = customIncomeItems.find(i => i.label === item.label && !i.is_custom && !i.id.startsWith('override-') && !i.id.startsWith('temp-'))
        if (existing) {
          await supabase.from('payout_income_items').update({ amount, is_removed: removed }).eq('id', existing.id)
        } else {
          // Delete any temp records first
          const tempRecords = customIncomeItems.filter(i => i.label === item.label && !i.is_custom && (i.id.startsWith('override-') || i.id.startsWith('temp-')))
          for (const temp of tempRecords) {
            if (!temp.id.startsWith('temp-') && !temp.id.startsWith('override-')) {
              // skip - only delete real DB records that shouldn't exist
            }
          }
          await supabase.from('payout_income_items').insert({
            payout_date_id: payoutId,
            label: item.label,
            amount,
            is_custom: false,
            is_removed: removed
          })
        }
      }

      // Save edited global expense item amounts
      for (const item of applicableExpense) {
        const editKey = `expense-${item.id}`
        const amount = parseFloat(editForm[editKey] ?? String(item.amount)) || item.amount
        const removed = isItemRemoved(item.label, customExpenseItems)
        const existing = customExpenseItems.find(i => i.label === item.label && !i.is_custom && !i.id.startsWith('override-') && !i.id.startsWith('temp-'))
        if (existing) {
          await supabase.from('payout_expense_items').update({ amount, is_removed: removed }).eq('id', existing.id)
        } else {
          await supabase.from('payout_expense_items').insert({
            payout_date_id: payoutId,
            label: item.label,
            amount,
            is_custom: false,
            is_removed: removed
          })
        }
      }

      // Save custom income items
      for (const item of customIncomeItems.filter(i => i.is_custom)) {
        const amount = parseFloat(editForm[item.id] ?? String(item.amount)) || item.amount
        const label = editForm[`${item.id}-label`] ?? item.label

        if (item.id.startsWith('temp-')) {
          const newItem = {
            payout_date_id: payoutId,
            label,
            amount,
            is_custom: true,
            is_removed: false
          }
          const { data } = await supabase.from('payout_income_items').insert(newItem).select().single()
          if (data) {
            setCustomIncomeItems(customIncomeItems.map(i => i.id === item.id ? { ...i, id: data.id } : i))
          }
        } else {
          await supabase.from('payout_income_items').update({ label, amount }).eq('id', item.id)
        }
      }

      // Save custom expense items
      for (const item of customExpenseItems.filter(i => i.is_custom)) {
        const amount = parseFloat(editForm[item.id] ?? String(item.amount)) || item.amount
        const label = editForm[`${item.id}-label`] ?? item.label

        if (item.id.startsWith('temp-')) {
          const newItem = {
            payout_date_id: payoutId,
            label,
            amount,
            is_custom: true,
            is_removed: false
          }
          const { data } = await supabase.from('payout_expense_items').insert(newItem).select().single()
          if (data) {
            setCustomExpenseItems(customExpenseItems.map(i => i.id === item.id ? { ...i, id: data.id } : i))
          }
        } else {
          await supabase.from('payout_expense_items').update({ label, amount }).eq('id', item.id)
        }
      }

      onSave()
    } catch (error) {
      console.error('Failed to save:', error)
    } finally {
      setSaving(false)
    }
  }

  const applicableIncome = getApplicableGlobalItems(globalIncomeItems)
  const applicableExpense = getApplicableGlobalItems(globalExpenseItems)

  const totalIncome = [
    ...applicableIncome.filter(i => !isItemRemoved(i.label, customIncomeItems)).map(i => {
      const editKey = `income-${i.id}`
      return {
        label: i.label,
        amount: parseFloat(editForm[editKey] ?? String(getCustomAmount(i.label, customIncomeItems) ?? i.amount)) || i.amount
      }
    }),
    ...customIncomeItems.filter(i => i.is_custom && !i.is_removed).map(i => ({
      label: editForm[`${i.id}-label`] ?? i.label,
      amount: parseFloat(editForm[i.id] ?? String(i.amount)) || i.amount
    }))
  ].reduce((sum, i) => sum + i.amount, 0)

  const totalExpenses = [
    ...applicableExpense.filter(i => !isItemRemoved(i.label, customExpenseItems)).map(i => {
      const editKey = `expense-${i.id}`
      return {
        label: i.label,
        amount: parseFloat(editForm[editKey] ?? String(getCustomAmount(i.label, customExpenseItems) ?? i.amount)) || i.amount
      }
    }),
    ...customExpenseItems.filter(i => i.is_custom && !i.is_removed).map(i => ({
      label: editForm[`${i.id}-label`] ?? i.label,
      amount: parseFloat(editForm[i.id] ?? String(i.amount)) || i.amount
    }))
  ].reduce((sum, i) => sum + i.amount, 0)

  const remaining = totalIncome - totalExpenses

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Edit Payout</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Income */}
          <div>
            <h4 className="text-sm font-medium text-green-600 dark:text-green-400 mb-2">Income</h4>
            <div className="space-y-2">
              {applicableIncome.filter(item => !isItemRemoved(item.label, customIncomeItems)).map(item => {
                const customAmount = getCustomAmount(item.label, customIncomeItems)
                const displayAmount = customAmount ?? item.amount
                const editKey = `income-${item.id}`
                const currentAmount = editForm[editKey] ?? String(displayAmount)
                return (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded">
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => toggleIncomeItem(item.label)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={currentAmount}
                        onChange={(e) => {
                          setEditForm({ ...editForm, [editKey]: e.target.value })
                          // Also update custom items if exists
                          const existing = customIncomeItems.find(i => i.label === item.label)
                          if (existing) {
                            setCustomIncomeItems(customIncomeItems.map(i =>
                              i.id === existing.id ? { ...i, amount: parseFloat(e.target.value) || 0 } : i
                            ))
                          } else {
                            setCustomIncomeItems([...customIncomeItems, {
                              id: `override-income-${item.id}`,
                              label: item.label,
                              amount: parseFloat(e.target.value) || 0,
                              is_custom: false,
                              is_removed: false
                            }])
                          }
                        }}
                        disabled={false}
                        className="w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:text-white text-sm disabled:opacity-50"
                      />
                    </div>
                  </div>
                )
              })}
              {customIncomeItems.filter(i => i.is_custom).map(item => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editForm[`${item.id}-label`] ?? item.label}
                      onChange={(e) => updateItemLabel('income', item.id, e.target.value)}
                      className="flex-1 px-2 py-1 border rounded dark:bg-gray-700 dark:text-white text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editForm[item.id] ?? String(item.amount)}
                      onChange={(e) => updateItemAmount('income', item.id, e.target.value)}
                      className="w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:text-white text-sm"
                    />
                    <button onClick={() => removeCustomItem('income', item.id)} className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <select
                onChange={(e) => {
                  if (e.target.value === 'new') {
                    addCustomIncomeItem()
                  } else if (e.target.value) {
                    // Re-add a removed global item
                    toggleIncomeItem(e.target.value)
                  }
                  e.target.value = ''
                }}
                className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:text-white text-sm"
                defaultValue=""
              >
                <option value="" disabled>+ Add Income...</option>
                {globalIncomeItems
                  .filter(i => isItemRemoved(i.label, customIncomeItems))
                  .map(item => (
                    <option key={item.id} value={item.label}>
                      {item.label} (₱{formatCurrency(item.amount)})
                    </option>
                  ))}
                <option value="new">+ New custom income item</option>
              </select>
            </div>
          </div>

          {/* Expenses */}
          <div>
            <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">Expenses & Bills</h4>
            <div className="space-y-2">
              {applicableExpense.filter(item => !isItemRemoved(item.label, customExpenseItems)).map(item => {
                const customAmount = getCustomAmount(item.label, customExpenseItems)
                const displayAmount = customAmount ?? item.amount
                const editKey = `expense-${item.id}`
                const currentAmount = editForm[editKey] ?? String(displayAmount)
                return (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded">
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        type="checkbox"
                        checked={true}
                        onChange={() => toggleExpenseItem(item.label)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={currentAmount}
                        onChange={(e) => {
                          setEditForm({ ...editForm, [editKey]: e.target.value })
                          const existing = customExpenseItems.find(i => i.label === item.label)
                          if (existing) {
                            setCustomExpenseItems(customExpenseItems.map(i =>
                              i.id === existing.id ? { ...i, amount: parseFloat(e.target.value) || 0 } : i
                            ))
                          } else {
                            setCustomExpenseItems([...customExpenseItems, {
                              id: `override-expense-${item.id}`,
                              label: item.label,
                              amount: parseFloat(e.target.value) || 0,
                              is_custom: false,
                              is_removed: false
                            }])
                          }
                        }}
                        disabled={false}
                        className="w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:text-white text-sm disabled:opacity-50"
                      />
                    </div>
                  </div>
                )
              })}
              {customExpenseItems.filter(i => i.is_custom).map(item => (
                <div key={item.id} className="flex items-center justify-between p-2 rounded">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editForm[`${item.id}-label`] ?? item.label}
                      onChange={(e) => updateItemLabel('expense', item.id, e.target.value)}
                      className="flex-1 px-2 py-1 border rounded dark:bg-gray-700 dark:text-white text-sm"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={editForm[item.id] ?? String(item.amount)}
                      onChange={(e) => updateItemAmount('expense', item.id, e.target.value)}
                      className="w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:text-white text-sm"
                    />
                    <button onClick={() => removeCustomItem('expense', item.id)} className="text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <select
                onChange={(e) => {
                  if (e.target.value === 'new') {
                    addCustomExpenseItem()
                  } else if (e.target.value) {
                    toggleExpenseItem(e.target.value)
                  }
                  e.target.value = ''
                }}
                className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:text-white text-sm"
                defaultValue=""
              >
                <option value="" disabled>+ Add Expense...</option>
                {globalExpenseItems
                  .filter(i => isItemRemoved(i.label, customExpenseItems))
                  .map(item => (
                    <option key={item.id} value={item.label}>
                      {item.label} (₱{formatCurrency(item.amount)})
                    </option>
                  ))}
                <option value="new">+ New custom expense item</option>
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <div className="flex justify-between font-semibold text-lg">
              <span>Remaining</span>
              <span className={remaining >= 0 ? 'text-green-600' : 'text-red-600'}>₱{formatCurrency(remaining)}</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
