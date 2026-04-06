import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react'

interface IncomeItem {
  id: string
  label: string
  amount: number
  effective_date: string
}

interface ExpenseItem {
  id: string
  label: string
  amount: number
  effective_date: string
}

export default function Settings() {
  const { user } = useAuth()
  const [projectionId, setProjectionId] = useState<string | null>(null)
  const [incomeItems, setIncomeItems] = useState<IncomeItem[]>([])
  const [expenseItems, setExpenseItems] = useState<ExpenseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editingIncome, setEditingIncome] = useState<string | null>(null)
  const [editingExpense, setEditingExpense] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ label: string; amount: string; effective_date: string }>({ label: '', amount: '', effective_date: '' })

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

    if (error) {
      setLoading(false)
      return
    }

    setProjectionId(data.id)
    await Promise.all([
      fetchIncomeItems(data.id),
      fetchExpenseItems(data.id)
    ])
    setLoading(false)
  }

  const fetchIncomeItems = async (projId: string) => {
    const { data, error } = await supabase
      .from('income_items')
      .select('*')
      .eq('projection_id', projId)
      .order('effective_date', { ascending: true })

    if (!error && data) setIncomeItems(data)
  }

  const fetchExpenseItems = async (projId: string) => {
    const { data, error } = await supabase
      .from('expense_items')
      .select('*')
      .eq('projection_id', projId)
      .order('effective_date', { ascending: true })

    if (!error && data) setExpenseItems(data)
  }

  const addIncomeItem = async () => {
    if (!projectionId) return
    const newItem = { projection_id: projectionId, label: 'New Item', amount: 0, effective_date: new Date().toISOString().split('T')[0] }
    const { data, error } = await supabase.from('income_items').insert(newItem).select().single()
    if (!error && data) {
      setIncomeItems([...incomeItems, data])
      toast.success('Income item added')
    }
  }

  const addExpenseItem = async () => {
    if (!projectionId) return
    const newItem = { projection_id: projectionId, label: 'New Item', amount: 0, effective_date: new Date().toISOString().split('T')[0] }
    const { data, error } = await supabase.from('expense_items').insert(newItem).select().single()
    if (!error && data) {
      setExpenseItems([...expenseItems, data])
      toast.success('Expense item added')
    }
  }

  const deleteIncomeItem = async (id: string) => {
    const { error } = await supabase.from('income_items').delete().eq('id', id)
    if (!error) {
      setIncomeItems(incomeItems.filter(item => item.id !== id))
      toast.success('Income item deleted')
    }
  }

  const deleteExpenseItem = async (id: string) => {
    const { error } = await supabase.from('expense_items').delete().eq('id', id)
    if (!error) {
      setExpenseItems(expenseItems.filter(item => item.id !== id))
      toast.success('Expense item deleted')
    }
  }

  const startEditingIncome = (item: IncomeItem) => {
    setEditingIncome(item.id)
    setEditForm({ label: item.label, amount: String(item.amount), effective_date: item.effective_date })
  }

  const startEditingExpense = (item: ExpenseItem) => {
    setEditingExpense(item.id)
    setEditForm({ label: item.label, amount: String(item.amount), effective_date: item.effective_date })
  }

  const cancelEditing = () => {
    setEditingIncome(null)
    setEditingExpense(null)
    setEditForm({ label: '', amount: '', effective_date: '' })
  }

  const saveIncomeItem = async () => {
    if (!editingIncome) return
    const updates = { label: editForm.label, amount: parseFloat(editForm.amount) || 0, effective_date: editForm.effective_date }
    const { error } = await supabase.from('income_items').update(updates).eq('id', editingIncome)
    if (!error) {
      setIncomeItems(incomeItems.map(item => item.id === editingIncome ? { ...item, ...updates } : item))
      cancelEditing()
      toast.success('Income item updated')
    }
  }

  const saveExpenseItem = async () => {
    if (!editingExpense) return
    const updates = { label: editForm.label, amount: parseFloat(editForm.amount) || 0, effective_date: editForm.effective_date }
    const { error } = await supabase.from('expense_items').update(updates).eq('id', editingExpense)
    if (!error) {
      setExpenseItems(expenseItems.map(item => item.id === editingExpense ? { ...item, ...updates } : item))
      cancelEditing()
      toast.success('Expense item updated')
    }
  }

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
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Settings - Manage Items</h1>

      {/* Income Items */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Income Items</h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Label</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Effective Date</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {incomeItems.map(item => (
                <tr key={item.id} className="bg-white dark:bg-gray-800">
                  <td className="px-4 py-2">
                    {editingIncome === item.id ? (
                      <input
                        type="text"
                        value={editForm.label}
                        onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                        className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:text-white"
                        autoFocus
                      />
                    ) : item.label}
                  </td>
                  <td className="px-4 py-2">
                    {editingIncome === item.id ? (
                      <input
                        type="number"
                        value={editForm.amount}
                        onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                        className="w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:text-white"
                      />
                    ) : `$${item.amount.toFixed(2)}`}
                  </td>
                  <td className="px-4 py-2">
                    {editingIncome === item.id ? (
                      <input
                        type="date"
                        value={editForm.effective_date}
                        onChange={(e) => setEditForm({ ...editForm, effective_date: e.target.value })}
                        className="px-2 py-1 border rounded dark:bg-gray-700 dark:text-white"
                      />
                    ) : item.effective_date}
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    {editingIncome === item.id ? (
                      <>
                        <button onClick={saveIncomeItem} className="text-green-500 hover:text-green-400">
                          <Save className="w-4 h-4 inline" />
                        </button>
                        <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-400">
                          <X className="w-4 h-4 inline" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEditingIncome(item)} className="text-blue-500 hover:text-blue-400">
                          <Edit2 className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => deleteIncomeItem(item.id)} className="text-red-500 hover:text-red-400">
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addIncomeItem} className="mt-2 flex items-center text-sm text-blue-600 hover:text-blue-500">
          <Plus className="w-4 h-4 mr-1" /> Add Income Item
        </button>
      </div>

      {/* Expense Items */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Expense Items</h2>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Label</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Amount</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Effective Date</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {expenseItems.map(item => (
                <tr key={item.id} className="bg-white dark:bg-gray-800">
                  <td className="px-4 py-2">
                    {editingExpense === item.id ? (
                      <input
                        type="text"
                        value={editForm.label}
                        onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
                        className="w-full px-2 py-1 border rounded dark:bg-gray-700 dark:text-white"
                        autoFocus
                      />
                    ) : item.label}
                  </td>
                  <td className="px-4 py-2">
                    {editingExpense === item.id ? (
                      <input
                        type="number"
                        value={editForm.amount}
                        onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                        className="w-24 px-2 py-1 border rounded dark:bg-gray-700 dark:text-white"
                      />
                    ) : `$${item.amount.toFixed(2)}`}
                  </td>
                  <td className="px-4 py-2">
                    {editingExpense === item.id ? (
                      <input
                        type="date"
                        value={editForm.effective_date}
                        onChange={(e) => setEditForm({ ...editForm, effective_date: e.target.value })}
                        className="px-2 py-1 border rounded dark:bg-gray-700 dark:text-white"
                      />
                    ) : item.effective_date}
                  </td>
                  <td className="px-4 py-2 text-right space-x-2">
                    {editingExpense === item.id ? (
                      <>
                        <button onClick={saveExpenseItem} className="text-green-500 hover:text-green-400">
                          <Save className="w-4 h-4 inline" />
                        </button>
                        <button onClick={cancelEditing} className="text-gray-500 hover:text-gray-400">
                          <X className="w-4 h-4 inline" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => startEditingExpense(item)} className="text-blue-500 hover:text-blue-400">
                          <Edit2 className="w-4 h-4 inline" />
                        </button>
                        <button onClick={() => deleteExpenseItem(item.id)} className="text-red-500 hover:text-red-400">
                          <Trash2 className="w-4 h-4 inline" />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={addExpenseItem} className="mt-2 flex items-center text-sm text-blue-600 hover:text-blue-500">
          <Plus className="w-4 h-4 mr-1" /> Add Expense Item
        </button>
      </div>
    </div>
  )
}
