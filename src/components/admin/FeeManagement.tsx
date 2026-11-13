import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  Download,
  FileText,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Users,
  Wallet,
} from 'lucide-react';
import { FormEvent, useMemo, useState } from 'react';
import { CourseRecord, FeeRecord, StudentRecord } from '../../types/institute';
import { Modal } from '../ui/Modal';
import { StatusText } from '../ui/StatusText';

interface FeeManagementProps {
  fees: FeeRecord[];
  students: StudentRecord[];
  courses: CourseRecord[];
  onCreateVoucher: (studentId?: string) => void;
  onEditVoucher: (fee: FeeRecord) => void;
  onDeleteVoucher: (fee: FeeRecord) => Promise<void>;
  onRecordPayment: (params: {
    fee: FeeRecord;
    paymentAmount: number;
    paidDate: string;
    notes: string;
  }) => Promise<{ newPaidAmount: number; nextStatus: 'paid' | 'partial' | 'pending' }>;
  onNotify: (msg: string) => void;
}

type FeeViewMode = 'vouchers' | 'balances';
type FeeStatusFilter = 'all' | 'pending' | 'partial' | 'paid';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function FeeManagement({
  fees,
  students,
  courses,
  onCreateVoucher,
  onEditVoucher,
  onDeleteVoucher,
  onRecordPayment,
  onNotify,
}: FeeManagementProps) {
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [viewMode, setViewMode] = useState<FeeViewMode>('vouchers');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FeeStatusFilter>('all');
  const [courseFilter, setCourseFilter] = useState<string>('all');

  // Quick Record Payment modal state
  const [payingFee, setPayingFee] = useState<FeeRecord | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [paymentDate, setPaymentDate] = useState<string>(todayIso);
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [paymentSaving, setPaymentSaving] = useState<boolean>(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [openReceiptAfterSave, setOpenReceiptAfterSave] = useState<boolean>(true);

  // Payment Receipt modal state
  const [receiptFee, setReceiptFee] = useState<FeeRecord | null>(null);

  const summary = useMemo(() => {
    const totalBilled = fees.reduce((acc, f) => acc + (Number(f.amount) || 0), 0);
    const totalCollected = fees.reduce((acc, f) => acc + (Number(f.paidAmount) || 0), 0);
    const pendingBalance = fees.reduce(
      (acc, f) => acc + Math.max(0, (Number(f.amount) || 0) - (Number(f.paidAmount) || 0)),
      0
    );
    const unpaidCount = fees.filter((f) => f.status !== 'paid').length;
    const overdueCount = fees.filter(
      (f) => f.status !== 'paid' && f.dueDate && f.dueDate < todayIso
    ).length;
    const collectionRate =
      totalBilled === 0 ? 100 : Math.round((totalCollected / totalBilled) * 100);

    return {
      totalBilled,
      totalCollected,
      pendingBalance,
      unpaidCount,
      overdueCount,
      collectionRate,
    };
  }, [fees, todayIso]);

  const sortedFees = useMemo(() => {
    return [...fees].sort((a, b) => {
      const aUnpaid = a.status !== 'paid' ? 0 : 1;
      const bUnpaid = b.status !== 'paid' ? 0 : 1;
      if (aUnpaid !== bUnpaid) return aUnpaid - bUnpaid;
      return (b.dueDate || '').localeCompare(a.dueDate || '');
    });
  }, [fees]);

  const filteredFees = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedFees.filter((f) => {
      if (statusFilter !== 'all' && f.status !== statusFilter) return false;
      if (courseFilter !== 'all' && f.courseId !== courseFilter) return false;
      if (!q) return true;
      return (
        f.studentName.toLowerCase().includes(q) ||
        f.studentRollNumber.toLowerCase().includes(q) ||
        f.receiptNo.toLowerCase().includes(q) ||
        f.monthLabel.toLowerCase().includes(q) ||
        f.courseTitle.toLowerCase().includes(q)
      );
    });
  }, [sortedFees, statusFilter, courseFilter, searchQuery]);

  const studentBalances = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students
      .map((student) => {
        const studentFees = fees.filter((f) => f.studentId === student.id);
        const billed = studentFees.reduce((acc, f) => acc + (Number(f.amount) || 0), 0);
        const paid = studentFees.reduce((acc, f) => acc + (Number(f.paidAmount) || 0), 0);
        const balance = studentFees.reduce(
          (acc, f) => acc + Math.max(0, (Number(f.amount) || 0) - (Number(f.paidAmount) || 0)),
          0
        );
        const unpaidVouchers = studentFees.filter((f) => f.status !== 'paid').length;
        const primaryCourse = courses.find((c) => c.id === student.primaryCourseId);

        return {
          student,
          primaryCourseTitle: primaryCourse?.title || 'Diploma Track',
          voucherCount: studentFees.length,
          unpaidVouchers,
          billed,
          paid,
          balance,
        };
      })
      .filter((row) => {
        if (courseFilter !== 'all' && !row.student.courseIds.includes(courseFilter)) return false;
        if (statusFilter === 'pending' && row.balance === 0) return false;
        if (statusFilter === 'paid' && (row.balance > 0 || row.voucherCount === 0)) return false;
        if (statusFilter === 'partial' && row.student.feeStatus !== 'partial') return false;
        if (!q) return true;
        return (
          row.student.fullName.toLowerCase().includes(q) ||
          row.student.rollNumber.toLowerCase().includes(q) ||
          row.student.email.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.balance - a.balance || a.student.rollNumber.localeCompare(b.student.rollNumber));
  }, [students, fees, courses, searchQuery, courseFilter, statusFilter]);

  const hasFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || courseFilter !== 'all';

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setCourseFilter('all');
  };

  const openPaymentModal = (fee: FeeRecord) => {
    const remaining = Math.max(0, fee.amount - fee.paidAmount);
    setPayingFee(fee);
    setPaymentAmount(remaining);
    setPaymentDate(todayIso);
    setPaymentNotes(fee.notes || '');
    setPaymentError(null);
    setOpenReceiptAfterSave(true);
  };

  const handlePaymentSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!payingFee) return;
    const remaining = Math.max(0, payingFee.amount - payingFee.paidAmount);
    const amountNum = Number(paymentAmount) || 0;

    if (amountNum <= 0) {
      setPaymentError('Enter a payment amount greater than 0.');
      return;
    }
    if (amountNum > remaining) {
      setPaymentError(`Payment exceeds remaining balance (PKR ${remaining.toLocaleString()}).`);
      return;
    }

    setPaymentSaving(true);
    setPaymentError(null);
    try {
      const result = await onRecordPayment({
        fee: payingFee,
        paymentAmount: amountNum,
        paidDate: paymentDate,
        notes: paymentNotes.trim(),
      });

      const updatedReceipt: FeeRecord = {
        ...payingFee,
        paidAmount: result.newPaidAmount,
        status: result.nextStatus,
        paidDate: paymentDate,
        notes: paymentNotes.trim(),
      };

      setPayingFee(null);
      if (openReceiptAfterSave) {
        setReceiptFee(updatedReceipt);
      }
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : 'Unable to record payment.');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleDownloadReceipt = (fee: FeeRecord) => {
    const balance = Math.max(0, fee.amount - fee.paidAmount);
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment Receipt ${escapeHtml(fee.receiptNo)} - Leads Nexus Institute</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; color: #0f172a; margin: 40px; background: #fff; }
    .receipt { max-width: 720px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; padding: 32px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
    .brand { font-size: 20px; font-weight: 700; }
    .sub { font-size: 12px; color: #475569; margin-top: 4px; }
    .meta { text-align: right; font-family: ui-monospace, monospace; font-size: 12px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; font-size: 13px; }
    .label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 2px; }
    .val { font-weight: 600; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 14px; }
    th, td { padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
    th { text-align: left; color: #475569; font-weight: 600; font-size: 12px; }
    .num { text-align: right; font-family: ui-monospace, monospace; font-weight: 600; }
    .footer { margin-top: 28px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; display: flex; justify-content: space-between; }
  </style>
</head>
<body>
  <div class="receipt">
    <div class="header">
      <div>
        <div class="brand">Leads Nexus Institute</div>
        <div class="sub">Computer Diploma Programs · Official Tuition Payment Receipt</div>
      </div>
      <div class="meta">
        <div><strong>Receipt:</strong> ${escapeHtml(fee.receiptNo)}</div>
        <div><strong>Status:</strong> ${escapeHtml(fee.status.toUpperCase())}</div>
      </div>
    </div>
    <div class="grid">
      <div>
        <div class="label">Student Name</div>
        <div class="val">${escapeHtml(fee.studentName)}</div>
      </div>
      <div>
        <div class="label">Roll Number</div>
        <div class="val">${escapeHtml(fee.studentRollNumber)}</div>
      </div>
      <div>
        <div class="label">Diploma Course</div>
        <div class="val">${escapeHtml(fee.courseTitle)}</div>
      </div>
      <div>
        <div class="label">Billing Month</div>
        <div class="val">${escapeHtml(fee.monthLabel)}</div>
      </div>
      <div>
        <div class="label">Due Date</div>
        <div class="val">${escapeHtml(fee.dueDate || '—')}</div>
      </div>
      <div>
        <div class="label">Payment Date</div>
        <div class="val">${escapeHtml(fee.paidDate || 'Unpaid')}</div>
      </div>
    </div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="num">Amount (PKR)</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Monthly Diploma Tuition Fee (${escapeHtml(fee.monthLabel)})</td>
          <td class="num">PKR ${fee.amount.toLocaleString()}</td>
        </tr>
        <tr>
          <td>Total Amount Paid</td>
          <td class="num">PKR ${fee.paidAmount.toLocaleString()}</td>
        </tr>
        <tr>
          <td><strong>Remaining Pending Balance</strong></td>
          <td class="num"><strong>PKR ${balance.toLocaleString()}</strong></td>
        </tr>
      </tbody>
    </table>
    <div class="footer">
      <div>Reference / Notes: ${escapeHtml(fee.notes || 'Standard Tuition Payment')}</div>
      <div>Issued: ${escapeHtml(todayIso)}</div>
    </div>
  </div>
</body>
</html>`;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Receipt-${fee.receiptNo || fee.id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onNotify(`Downloaded receipt ${fee.receiptNo}.`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">Fee Management</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track student tuition payments, monitor pending balances, and issue payment receipts.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-200/70 p-1">
            <button
              type="button"
              onClick={() => setViewMode('vouchers')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'vouchers'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              <span>Voucher Ledger</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('balances')}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'balances'
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-600 hover:text-slate-950'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Student Balances</span>
            </button>
          </div>

          <button
            type="button"
            disabled={students.length === 0}
            onClick={() => onCreateVoucher()}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-50 whitespace-nowrap shrink-0"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Create Fee Voucher</span>
          </button>
        </div>
      </div>

      {/* Financial Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Total Billed</span>
            <CreditCard className="h-4 w-4 text-slate-500" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-slate-950">
            PKR {summary.totalBilled.toLocaleString()}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
            {fees.length} issued voucher{fees.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Collected Payments</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            PKR {summary.totalCollected.toLocaleString()}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
            {summary.collectionRate}% collection rate
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Pending Balance</span>
            <Wallet className="h-4 w-4 text-amber-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700">
            PKR {summary.pendingBalance.toLocaleString()}
          </div>
          <div className="mt-1.5 text-xs text-slate-500 font-mono tabular-nums">
            {summary.unpaidCount} unpaid or partial voucher{summary.unpaidCount === 1 ? '' : 's'}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>Overdue Vouchers</span>
            <AlertCircle className="h-4 w-4 text-rose-700" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono tabular-nums text-rose-700">
            {summary.overdueCount}
          </div>
          <div className="mt-1.5 text-xs text-slate-500">
            Past due date before {todayIso}
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {/* Search & Filter Toolbar */}
        <div className="border-b border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 flex-1 min-w-[220px] max-w-sm">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search student, roll no, receipt, or month..."
                className="w-full text-xs focus:outline-none"
              />
            </div>

            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              aria-label="Filter by course"
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-700 focus:outline-none"
            >
              <option value="all">All Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} · {c.title}
                </option>
              ))}
            </select>

            {hasFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Clear</span>
              </button>
            )}
          </div>

          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 self-start lg:self-auto">
            {(['all', 'pending', 'partial', 'paid'] as const).map((statusKey) => (
              <button
                key={statusKey}
                type="button"
                onClick={() => setStatusFilter(statusKey)}
                className={`rounded-md px-3 py-1 text-xs font-semibold capitalize transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === statusKey
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-600 hover:text-slate-950'
                }`}
              >
                {statusKey}
              </button>
            ))}
          </div>
        </div>

        {/* View 1: Voucher Ledger */}
        {viewMode === 'vouchers' && (
          <>
            {fees.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-semibold text-slate-800">No fee vouchers issued yet</p>
                <p className="mt-1 text-xs text-slate-500">
                  Create a monthly tuition voucher to start tracking payments and issuing receipts.
                </p>
                {students.length > 0 && (
                  <button
                    type="button"
                    onClick={() => onCreateVoucher()}
                    className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                  >
                    Create First Fee Voucher
                  </button>
                )}
              </div>
            ) : filteredFees.length === 0 ? (
              <div className="p-10 text-center">
                <p className="text-sm font-semibold text-slate-800">
                  No fee vouchers match your filters
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Clear search or status filters to view all tuition records.
                </p>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="mt-4 rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Reset Filters
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Receipt</th>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Month / Course</th>
                      <th className="px-5 py-3 text-right">Billed</th>
                      <th className="px-5 py-3 text-right">Paid</th>
                      <th className="px-5 py-3 text-right">Balance</th>
                      <th className="px-5 py-3">Due / Paid Date</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredFees.map((f) => {
                      const balance = Math.max(0, (Number(f.amount) || 0) - (Number(f.paidAmount) || 0));
                      const isOverdue = f.status !== 'paid' && f.dueDate && f.dueDate < todayIso;

                      return (
                        <tr key={f.id} className="hover:bg-slate-50/70">
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                            {f.receiptNo}
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-900">{f.studentName}</div>
                            <div className="font-mono text-xs text-slate-500">
                              {f.studentRollNumber}
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-xs">
                            <div className="font-medium text-slate-900">{f.monthLabel}</div>
                            <div className="text-slate-500">{f.courseTitle}</div>
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                            PKR {f.amount.toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono tabular-nums text-emerald-700 font-semibold whitespace-nowrap">
                            PKR {f.paidAmount.toLocaleString()}
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono tabular-nums whitespace-nowrap">
                            {balance > 0 ? (
                              <span className="font-semibold text-rose-700">
                                PKR {balance.toLocaleString()}
                              </span>
                            ) : (
                              <span className="text-slate-400">PKR 0</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-mono tabular-nums text-xs whitespace-nowrap">
                            <div className={isOverdue ? 'text-rose-700 font-semibold' : 'text-slate-600'}>
                              Due: {f.dueDate || '—'}
                            </div>
                            {f.paidDate && (
                              <div className="text-emerald-700">Paid: {f.paidDate}</div>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <StatusText status={f.status} />
                          </td>
                          <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-1.5">
                            {balance > 0 && (
                              <button
                                type="button"
                                onClick={() => openPaymentModal(f)}
                                className="rounded bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-800"
                              >
                                Record Payment
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setReceiptFee(f)}
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Receipt
                            </button>
                            <button
                              type="button"
                              onClick={() => onEditVoucher(f)}
                              className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteVoucher(f)}
                              className="rounded border border-rose-200 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* View 2: Per-Student Pending Balances */}
        {viewMode === 'balances' && (
          <>
            {studentBalances.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-500">
                No students match the current balance filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                    <tr>
                      <th className="px-5 py-3">Student</th>
                      <th className="px-5 py-3">Primary Course</th>
                      <th className="px-5 py-3 text-right">Monthly Rate</th>
                      <th className="px-5 py-3 text-right">Total Billed</th>
                      <th className="px-5 py-3 text-right">Total Paid</th>
                      <th className="px-5 py-3 text-right">Pending Balance</th>
                      <th className="px-5 py-3">Fee Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {studentBalances.map((row) => (
                      <tr key={row.student.id} className="hover:bg-slate-50/70">
                        <td className="px-5 py-3.5">
                          <div className="font-semibold text-slate-900">{row.student.fullName}</div>
                          <div className="font-mono text-xs text-slate-500">
                            {row.student.rollNumber} · {row.voucherCount} voucher
                            {row.voucherCount === 1 ? '' : 's'}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-xs text-slate-700">
                          {row.primaryCourseTitle}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                          PKR {row.student.monthlyFee.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                          PKR {row.billed.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono tabular-nums text-emerald-700 font-semibold whitespace-nowrap">
                          PKR {row.paid.toLocaleString()}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono tabular-nums whitespace-nowrap">
                          {row.balance > 0 ? (
                            <span className="font-bold text-rose-700">
                              PKR {row.balance.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-400">PKR 0</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <StatusText status={row.student.feeStatus} />
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap space-x-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSearchQuery(row.student.rollNumber);
                              setStatusFilter('all');
                              setViewMode('vouchers');
                            }}
                            className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Vouchers
                          </button>
                          <button
                            type="button"
                            onClick={() => onCreateVoucher(row.student.id)}
                            className="rounded bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-800"
                          >
                            Issue Voucher
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Record Payment Modal */}
      <Modal
        open={Boolean(payingFee)}
        title={payingFee ? `Record Payment · ${payingFee.studentName}` : 'Record Payment'}
        subtitle={
          payingFee
            ? `Receipt ${payingFee.receiptNo} · ${payingFee.monthLabel} (${payingFee.courseTitle})`
            : undefined
        }
        onClose={() => setPayingFee(null)}
        maxWidthClass="max-w-lg"
      >
        {payingFee && (
          <form onSubmit={handlePaymentSubmit} className="space-y-4">
            {paymentError && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {paymentError}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 border-y border-slate-200 py-3.5 text-xs">
              <div>
                <div className="text-slate-500">Total Billed</div>
                <div className="mt-1 font-mono tabular-nums font-bold text-slate-900">
                  PKR {payingFee.amount.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Already Paid</div>
                <div className="mt-1 font-mono tabular-nums font-bold text-emerald-700">
                  PKR {payingFee.paidAmount.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Balance Due</div>
                <div className="mt-1 font-mono tabular-nums font-bold text-rose-700">
                  PKR {Math.max(0, payingFee.amount - payingFee.paidAmount).toLocaleString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Payment Amount (PKR)
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setPaymentAmount(Math.max(0, payingFee.amount - payingFee.paidAmount))
                    }
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    Fill Full
                  </button>
                </div>
                <input
                  type="number"
                  min={1}
                  max={Math.max(1, payingFee.amount - payingFee.paidAmount)}
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-blue-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Date
                </label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums focus:border-blue-700 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Payment Reference / Notes
              </label>
              <input
                type="text"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                placeholder="e.g. Cash at front desk, Bank transfer #4821..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-700 focus:outline-none"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={openReceiptAfterSave}
                onChange={(e) => setOpenReceiptAfterSave(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
              />
              <span>Open payment receipt immediately after saving</span>
            </label>

            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
              <button
                type="button"
                onClick={() => setPayingFee(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={paymentSaving}
                className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {paymentSaving ? 'Saving...' : 'Confirm Payment'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Official Payment Receipt Modal */}
      <Modal
        open={Boolean(receiptFee)}
        title={receiptFee ? `Payment Receipt · ${receiptFee.receiptNo}` : 'Payment Receipt'}
        subtitle="Leads Nexus Institute Official Tuition Statement"
        onClose={() => setReceiptFee(null)}
        maxWidthClass="max-w-2xl"
      >
        {receiptFee && (
          <div className="space-y-6">
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-200 pb-4">
                <div>
                  <div className="text-lg font-bold text-slate-950">Leads Nexus Institute</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Computer Diploma Programs · Official Tuition Receipt
                  </div>
                </div>
                <div className="sm:text-right space-y-1">
                  <div className="font-mono text-xs text-slate-600">
                    Receipt No: <span className="font-bold text-slate-950">{receiptFee.receiptNo}</span>
                  </div>
                  <div className="flex sm:justify-end">
                    <StatusText status={receiptFee.status} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-xs text-slate-500">Student Name</div>
                  <div className="font-semibold text-slate-950">{receiptFee.studentName}</div>
                  <div className="font-mono text-xs text-slate-500">{receiptFee.studentEmail}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Roll Number &amp; Period</div>
                  <div className="font-mono font-semibold text-slate-950">
                    {receiptFee.studentRollNumber}
                  </div>
                  <div className="text-xs text-slate-600">{receiptFee.monthLabel}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Diploma Course</div>
                  <div className="font-medium text-slate-900">{receiptFee.courseTitle}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Due &amp; Payment Dates</div>
                  <div className="font-mono text-xs text-slate-700 mt-0.5">
                    Due: {receiptFee.dueDate || '—'} · Paid: {receiptFee.paidDate || 'Unpaid'}
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <table className="w-full text-sm">
                  <thead className="text-xs font-semibold text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="py-2 text-left">Fee Line Item</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="py-2.5 text-slate-700">
                        Tuition Fee ({receiptFee.monthLabel})
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-medium text-slate-900">
                        PKR {receiptFee.amount.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 text-slate-700">Total Amount Received</td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-emerald-700">
                        PKR {receiptFee.paidAmount.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold text-slate-950">Remaining Balance</td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-bold text-slate-950">
                        PKR{' '}
                        {Math.max(
                          0,
                          receiptFee.amount - receiptFee.paidAmount
                        ).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-500">
                <div>Notes: {receiptFee.notes || 'Standard Tuition Payment'}</div>
                <div className="font-mono">Issued: {todayIso}</div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3 print:hidden">
              <button
                type="button"
                onClick={() => setReceiptFee(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleDownloadReceipt(receiptFee)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 whitespace-nowrap"
              >
                <Download className="h-4 w-4" />
                <span>Download Receipt</span>
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
              >
                <Printer className="h-4 w-4" />
                <span>Print Receipt</span>
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
