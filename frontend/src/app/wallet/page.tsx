'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useCurrentUser } from '@/hooks/useCurrentUser'
import { useAuthStore } from '@/stores/authStore'
import { api } from '@/lib/api'
import { useI18n } from '@/i18n/I18nProvider'

interface Transaction {
  id: string
  amount: number
  type: string
  note: string
  createdAt: string
}

const TYPE_LABEL_KEYS = {
  SIGNUP: 'wallet.type.SIGNUP',
  EARN: 'wallet.type.EARN',
  SPEND: 'wallet.type.SPEND',
  BONUS: 'wallet.type.BONUS',
  PENALTY: 'wallet.type.PENALTY',
} as const

export default function WalletPage() {
  const router = useRouter()
  const { accessToken } = useAuthStore()
  const { data: user } = useCurrentUser()
  const { t } = useI18n()
  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ['credit-transactions'],
    queryFn: () => api.get('/credits/history').then((r) => r.data),
    enabled: !!user,
  })

  useEffect(() => {
    if (!accessToken) router.replace('/login')
  }, [accessToken, router])

  if (!accessToken) return null

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8 flex flex-col gap-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-gray-900">{t('wallet.title')}</h1>
        </div>
        {/* Balance card */}
        <div className="bg-blue-500 rounded-2xl p-6 text-white">
          <p className="text-sm opacity-80">{t('wallet.balance')}</p>
          <p className="text-4xl font-bold mt-1">{user?.credits ?? '—'}</p>
          <p className="text-sm opacity-70 mt-1">reputation {user?.reputationScore?.toFixed(1) ?? '—'}</p>
        </div>

        {/* Transaction history */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">{t('wallet.history')}</h2>
          </div>
          {!transactions || transactions.length === 0 ? (
            <p className="px-5 py-8 text-center text-gray-400 text-sm">{t('wallet.empty')}</p>
          ) : (
            <ul>
              {transactions.map((tx) => (
                <li key={tx.id} className="flex items-center justify-between px-5 py-4 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {tx.type in TYPE_LABEL_KEYS ? t(TYPE_LABEL_KEYS[tx.type as keyof typeof TYPE_LABEL_KEYS]) : tx.type}
                    </p>
                    {tx.note && <p className="text-xs text-gray-400 mt-0.5">{tx.note}</p>}
                  </div>
                  <span className={`text-sm font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                    {tx.amount > 0 ? '+' : ''}{tx.amount}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  )
}
