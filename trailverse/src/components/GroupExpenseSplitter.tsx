"use client"

import { useState, useEffect, useCallback } from "react"
import {
  IndianRupee, Plus, Trash2, CheckCircle2, AlertCircle,
  FileCheck2, Shield, QrCode, ExternalLink, ArrowRight, X, Loader2
} from "lucide-react"
import {
  getGroupExpenses, createGroupExpense, deleteGroupExpense,
  setGroupUpi, settleExpense
} from "@/lib/api"
import type { GroupExpensesResponse } from "@/lib/api"

type Props = {
  groupId: string
  currentUsername: string | null
  isHost: boolean
  members: { name: string; username: string }[]
}

const CATEGORY_ICONS: Record<string, { label: string; icon: string; color: string }> = {
  permit:    { label: "Permit & Entry", icon: "🎫", color: "text-purple-400 bg-purple-500/10 border-purple-500/20" },
  transport: { label: "Transport & Cab", icon: "🚐", color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  food:      { label: "Food & Ration", icon: "🍲", color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  guide:     { label: "Guide & Porter", icon: "🧭", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" },
  stay:      { label: "Camping & Stay", icon: "⛺", color: "text-pink-400 bg-pink-500/10 border-pink-500/20" },
  gear:      { label: "Gear & Rental", icon: "🎒", color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
  other:     { label: "Miscellaneous", icon: "📦", color: "text-zinc-400 bg-white/5 border-white/10" },
}

export default function GroupExpenseSplitter({ groupId, currentUsername, isHost, members }: Props) {
  const [data, setData] = useState<GroupExpensesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [showUpiModal, setShowUpiModal] = useState(false)
  const [activePaymentDebt, setActivePaymentDebt] = useState<{ from_user: string; to_user: string; amount: number } | null>(null)

  // Add Expense Form State
  const [title, setTitle] = useState("")
  const [category, setCategory] = useState("permit")
  const [amount, setAmount] = useState("")
  const [paidBy, setPaidBy] = useState(currentUsername || "")
  const [splitAll, setSplitAll] = useState(true)
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  // UPI Form State
  const [upiId, setUpiId] = useState("")
  const [upiName, setUpiName] = useState("")
  const [savingUpi, setSavingUpi] = useState(false)

  // Filter
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const loadExpenses = useCallback(async () => {
    try {
      setError("")
      const res = await getGroupExpenses(groupId)
      setData(res)
      if (res.upi) {
        setUpiId(res.upi.upi_id)
        setUpiName(res.upi.upi_name)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load expenses")
    } finally {
      setLoading(false)
    }
  }, [groupId])

  useEffect(() => {
    loadExpenses()
  }, [loadExpenses])

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title || !amount || parseFloat(amount) <= 0) return

    setSubmitting(true)
    setError("")
    try {
      await createGroupExpense(groupId, {
        title,
        category,
        amount: parseFloat(amount),
        paid_by: paidBy || currentUsername || "anonymous",
        split_members: splitAll ? ["all"] : selectedMembers,
      })
      setTitle("")
      setAmount("")
      setShowAddModal(false)
      await loadExpenses()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add expense")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteExpense = async (expenseId: string) => {
    if (!currentUsername) return
    try {
      await deleteGroupExpense(groupId, expenseId, currentUsername)
      await loadExpenses()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete expense")
    }
  }

  const handleSaveUpi = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!upiId || !currentUsername) return

    setSavingUpi(true)
    try {
      await setGroupUpi(groupId, {
        host_username: currentUsername,
        upi_id: upiId,
        upi_name: upiName || currentUsername,
      })
      setShowUpiModal(false)
      await loadExpenses()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save UPI details")
    } finally {
      setSavingUpi(false)
    }
  }

  const handleSettle = async (fromUser: string, toUser: string, amt: number) => {
    try {
      await settleExpense(groupId, {
        from_user: fromUser,
        to_user: toUser,
        amount: amt,
      })
      setActivePaymentDebt(null)
      await loadExpenses()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record settlement")
    }
  }

  const generateUpiUrl = (toUser: string, amt: number) => {
    const targetUpi = data?.upi?.upi_id || "trekker@upi"
    const payeeName = encodeURIComponent(data?.upi?.upi_name || toUser)
    const note = encodeURIComponent(`TrailVerse Group Expense Split`)
    return `upi://pay?pa=${targetUpi}&pn=${payeeName}&am=${amt}&tn=${note}&cu=INR`
  }

  if (loading) {
    return (
      <div className="bg-white/5 border border-white/10 rounded-2xl p-6 animate-pulse space-y-4">
        <div className="h-6 bg-white/10 rounded w-1/3" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-24 bg-white/5 rounded-xl" />
          <div className="h-24 bg-white/5 rounded-xl" />
          <div className="h-24 bg-white/5 rounded-xl" />
        </div>
      </div>
    )
  }

  const summary = data?.summary || {
    total_amount: 0,
    permit_amount: 0,
    category_totals: {},
    balances: {},
    debts: [],
  }

  const myBalance = currentUsername ? (summary.balances[currentUsername] ?? 0) : 0
  const filteredExpenses = (data?.expenses || []).filter(
    (e) => selectedCategory === "all" || e.category === selectedCategory
  )

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-6">
      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xl">💰</span>
            <h2 className="text-white font-bold text-lg">Expense & Permit Splitter</h2>
          </div>
          <p className="text-white/40 text-xs mt-1">
            Track forest permits, cabs, stays, and simplify member splits with instant UPI payments
          </p>
        </div>

        <div className="flex items-center gap-2">
          {data?.upi ? (
            <button
              onClick={() => setShowUpiModal(true)}
              className="text-xs bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
              title="Click to view or edit host UPI details"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              <span>UPI: {data.upi.upi_id}</span>
            </button>
          ) : (
            <button
              onClick={() => setShowUpiModal(true)}
              className="text-xs bg-white/5 hover:bg-white/10 border border-white/15 text-white/80 hover:text-white px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-400" />
              Set Host UPI
            </button>
          )}

          <button
            onClick={() => {
              setPaidBy(currentUsername || "")
              setShowAddModal(true)
            }}
            className="text-xs bg-emerald-500 hover:bg-emerald-400 text-white font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Expense / Permit
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-red-400 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* TOP STAT TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Cost */}
        <div className="bg-black/40 border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-white/40 mb-1">
            <span>Total Group Spend</span>
            <span>{data?.expenses.length || 0} items</span>
          </div>
          <div className="text-2xl font-bold text-white flex items-center">
            <IndianRupee className="w-5 h-5 text-emerald-400" />
            {summary.total_amount.toLocaleString("en-IN")}
          </div>
        </div>

        {/* Permits & Passes */}
        <div className="bg-black/40 border border-purple-500/20 rounded-xl p-4">
          <div className="flex items-center justify-between text-xs text-purple-300/60 mb-1">
            <span className="flex items-center gap-1">
              <FileCheck2 className="w-3.5 h-3.5 text-purple-400" />
              Forest & Entry Permits
            </span>
            <span className="text-purple-400 font-medium">Checked</span>
          </div>
          <div className="text-2xl font-bold text-purple-300 flex items-center">
            <IndianRupee className="w-5 h-5 text-purple-400" />
            {summary.permit_amount.toLocaleString("en-IN")}
          </div>
        </div>

        {/* User Balance */}
        <div className={`border rounded-xl p-4 ${
          myBalance > 0.01
            ? "bg-emerald-500/5 border-emerald-500/30 text-emerald-400"
            : myBalance < -0.01
            ? "bg-red-500/5 border-red-500/30 text-red-400"
            : "bg-black/40 border-white/10 text-white/50"
        }`}>
          <div className="text-xs text-white/40 mb-1">Your Net Balance</div>
          <div className="text-2xl font-bold flex items-center">
            {myBalance > 0.01 ? (
              <span>+₹{myBalance.toLocaleString("en-IN")} (You get back)</span>
            ) : myBalance < -0.01 ? (
              <span>-₹{Math.abs(myBalance).toLocaleString("en-IN")} (You owe)</span>
            ) : (
              <span>₹0 (All settled)</span>
            )}
          </div>
        </div>
      </div>

      {/* PERMIT SAFETY NOTIFICATION */}
      {summary.permit_amount > 0 && (
        <div className="bg-purple-950/20 border border-purple-500/20 rounded-xl p-3.5 flex items-start gap-3">
          <Shield className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
          <div className="text-xs text-purple-200/80 leading-relaxed">
            <span className="font-semibold text-purple-300">Forest Permit Documented: </span>
            A total of ₹{summary.permit_amount} has been split for forest department & local panchayat access. Always keep digital screenshots or offline receipts handy at mountain checkpoints.
          </div>
        </div>
      )}

      {/* WHO PAYS WHOM (SIMPLIFIED SETTLEMENTS) */}
      {summary.debts.length > 0 && (
        <div className="bg-black/30 border border-white/10 rounded-xl p-4 space-y-3">
          <h3 className="text-white text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
            Simplified Settlements ({summary.debts.length})
          </h3>

          <div className="space-y-2">
            {summary.debts.map((debt, idx) => {
              const iOwe = currentUsername && debt.from_user.toLowerCase() === currentUsername.toLowerCase()
              const owesMe = currentUsername && debt.to_user.toLowerCase() === currentUsername.toLowerCase()

              return (
                <div
                  key={idx}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border text-xs ${
                    iOwe
                      ? "bg-red-500/10 border-red-500/20 text-white"
                      : owesMe
                      ? "bg-emerald-500/10 border-emerald-500/20 text-white"
                      : "bg-white/[0.02] border-white/5 text-white/70"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">@{debt.from_user}</span>
                    <span className="text-white/40">owes</span>
                    <span className="font-semibold text-white">@{debt.to_user}</span>
                    <span className="text-emerald-400 font-bold ml-1">₹{debt.amount}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActivePaymentDebt({ from_user: debt.from_user, to_user: debt.to_user, amount: debt.amount })}
                      className="bg-emerald-500 hover:bg-emerald-400 text-white font-medium px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 shadow-sm text-xs"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      Pay via UPI
                    </button>

                    <button
                      onClick={() => handleSettle(debt.from_user, debt.to_user, debt.amount)}
                      className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      Mark Settled
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* CATEGORY FILTER PILLS */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
        <button
          onClick={() => setSelectedCategory("all")}
          className={`px-3 py-1.5 rounded-lg border transition-colors ${
            selectedCategory === "all"
              ? "bg-white text-black font-semibold border-white"
              : "bg-white/5 text-white/60 border-white/10 hover:border-white/20"
          }`}
        >
          All ({data?.expenses.length || 0})
        </button>

        {Object.entries(CATEGORY_ICONS).map(([key, item]) => {
          const count = (data?.expenses || []).filter((e) => e.category === key).length
          if (count === 0 && selectedCategory !== key) return null

          return (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`px-3 py-1.5 rounded-lg border transition-colors flex items-center gap-1.5 shrink-0 ${
                selectedCategory === key
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-semibold"
                  : "bg-white/5 text-white/60 border-white/10 hover:border-white/20"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              <span className="text-[10px] opacity-60">({count})</span>
            </button>
          )
        })}
      </div>

      {/* EXPENSES LIST */}
      <div className="space-y-2">
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-8 bg-black/20 border border-dashed border-white/10 rounded-xl">
            <p className="text-white/40 text-xs">No shared expenses logged in this view.</p>
            <p className="text-white/20 text-[11px] mt-1">Click &quot;Add Expense / Permit&quot; to log shared transport or permit fees.</p>
          </div>
        ) : (
          filteredExpenses.map((exp) => {
            const cat = CATEGORY_ICONS[exp.category] || CATEGORY_ICONS.other
            const canDelete = isHost || (currentUsername && exp.paid_by.toLowerCase() === currentUsername.toLowerCase())

            return (
              <div
                key={exp.id}
                className="flex items-center justify-between p-3.5 bg-black/40 border border-white/5 hover:border-white/15 rounded-xl transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-lg ${cat.color}`}>
                    {cat.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium">{exp.title}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${cat.color}`}>
                        {cat.label}
                      </span>
                    </div>
                    <p className="text-white/40 text-xs mt-0.5">
                      Paid by <span className="text-white/70 font-medium">@{exp.paid_by}</span>
                      {" · "}
                      {exp.split_members?.includes("all") ? "Split equally among all" : `Split with ${exp.split_members?.length} members`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <span className="text-white font-semibold text-sm">
                      ₹{exp.amount.toLocaleString("en-IN")}
                    </span>
                    <p className="text-white/30 text-[10px]">
                      {new Date(exp.created_at).toLocaleDateString()}
                    </p>
                  </div>

                  {canDelete && (
                    <button
                      onClick={() => handleDeleteExpense(exp.id)}
                      className="text-white/20 hover:text-red-400 p-1 transition-colors"
                      title="Delete expense"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* ADD EXPENSE MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/20 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base">Add Group Expense or Permit</h3>
              <button onClick={() => setShowAddModal(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddExpense} className="space-y-4 text-xs">
              <div>
                <label className="block text-white/60 mb-1">Expense Title *</label>
                <input
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Forest Department Trek Permit"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-white/60 mb-1">Amount (₹) *</label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 1500"
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-white/60 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-black border border-white/10 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-emerald-500"
                  >
                    {Object.entries(CATEGORY_ICONS).map(([k, item]) => (
                      <option key={k} value={k} className="bg-zinc-900">
                        {item.icon} {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-white/60 mb-1">Paid By (Username)</label>
                <input
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  placeholder={currentUsername || "username"}
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-white/60 mb-1">Split Option</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSplitAll(true)}
                    className={`flex-1 py-2 rounded-lg border text-center transition-colors ${
                      splitAll ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-black/40 border-white/10 text-white/50"
                    }`}
                  >
                    Split All Members
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitAll(false)}
                    className={`flex-1 py-2 rounded-lg border text-center transition-colors ${
                      !splitAll ? "bg-emerald-500/20 border-emerald-500 text-emerald-400" : "bg-black/40 border-white/10 text-white/50"
                    }`}
                  >
                    Custom Members
                  </button>
                </div>
              </div>

              {!splitAll && members.length > 0 && (
                <div className="space-y-1 max-h-32 overflow-y-auto p-2 bg-black/40 rounded-xl border border-white/10">
                  {members.map((m) => (
                    <label key={m.username} className="flex items-center gap-2 py-1 text-white/80 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(m.username)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedMembers([...selectedMembers, m.username])
                          else setSelectedMembers(selectedMembers.filter((u) => u !== m.username))
                        }}
                        className="rounded accent-emerald-500"
                      />
                      <span>{m.name} (@{m.username})</span>
                    </label>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {submitting ? "Adding..." : "Save Expense"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SET HOST UPI MODAL */}
      {showUpiModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/20 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-base">Host UPI Payment ID</h3>
              <button onClick={() => setShowUpiModal(false)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-white/50 text-xs">
              Allow members who owe group dues to pay you directly via Google Pay, PhonePe, or Paytm.
            </p>

            <form onSubmit={handleSaveUpi} className="space-y-3 text-xs">
              <div>
                <label className="block text-white/60 mb-1">Your UPI ID *</label>
                <input
                  required
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  placeholder="e.g. yourname@okhdfcbank"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-white/60 mb-1">Payee Name</label>
                <input
                  value={upiName}
                  onChange={(e) => setUpiName(e.target.value)}
                  placeholder="e.g. Varada Humane"
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-white placeholder:text-white/20 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingUpi}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
                >
                  {savingUpi ? "Saving..." : "Save UPI"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowUpiModal(false)}
                  className="px-4 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPI QR & DIRECT PAYMENT MODAL */}
      {activePaymentDebt && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-white/20 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mx-auto">
              <QrCode className="w-6 h-6" />
            </div>

            <div>
              <h3 className="text-white font-bold text-base">Pay ₹{activePaymentDebt.amount}</h3>
              <p className="text-white/40 text-xs mt-1">To @{activePaymentDebt.to_user}</p>
            </div>

            {data?.upi ? (
              <div className="bg-black/50 border border-white/10 rounded-xl p-4 text-xs space-y-3">
                <div className="flex justify-between items-center text-white/60">
                  <span>Host UPI ID:</span>
                  <span className="font-mono text-emerald-400 font-semibold select-all">{data.upi.upi_id}</span>
                </div>
                <div className="flex justify-between items-center text-white/60">
                  <span>Payee:</span>
                  <span className="text-white font-medium">{data.upi.upi_name}</span>
                </div>

                <a
                  href={generateUpiUrl(activePaymentDebt.to_user, activePaymentDebt.amount)}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2 mt-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Launch UPI App (GPay / PhonePe)
                </a>
              </div>
            ) : (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-400">
                Host hasn&apos;t registered a direct UPI ID yet. You can transfer manually or ask the host to set their UPI ID above.
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => handleSettle(activePaymentDebt.from_user, activePaymentDebt.to_user, activePaymentDebt.amount)}
                className="flex-1 bg-white/10 hover:bg-white/20 text-white font-medium py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                I Have Paid
              </button>
              <button
                onClick={() => setActivePaymentDebt(null)}
                className="px-4 bg-white/5 hover:bg-white/10 text-white/60 py-2 rounded-xl text-xs transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
