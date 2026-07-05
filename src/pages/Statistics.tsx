/**
 * 统计页面
 * 展示月度收支统计和分类占比
 */
import React, { useState, useEffect, useMemo } from 'react'
import { Select, Empty, Spin } from 'antd'
import dayjs from 'dayjs'
import type { Category, MonthlyStat } from '../types'
import { useMonthOptions } from '../hooks/useMonthOptions'
import { formatCurrency } from '../utils/format'

interface Props {
  categories: Category[]
}

const Statistics: React.FC<Props> = ({ categories }) => {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [stats, setStats] = useState<MonthlyStat[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [y, m] = month.split('-').map(Number)
        const res = await window.api.getMonthlyStats(y, m)
        if (res.success) setStats(res.data!)
      } catch (err) {
        console.error('加载统计数据失败:', err)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [month])

  // 支出统计
  const expenseStats = useMemo(() => stats.filter(s => s.type === 'expense'), [stats])
  const totalExpense = useMemo(() => expenseStats.reduce((s, i) => s + Number(i.total), 0), [expenseStats])

  // 收入统计
  const incomeStats = useMemo(() => stats.filter(s => s.type === 'income'), [stats])
  const totalIncome = useMemo(() => incomeStats.reduce((s, i) => s + Number(i.total), 0), [incomeStats])

  const monthOptions = useMonthOptions()

  const colors = ['#7ed321', '#5fa319', '#a8e66c', '#ff7875', '#ffa940', '#36cfc9', '#597ef7', '#b37feb', '#f759ab', '#ffc53d']

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>📊 月度统计</h2>
        <Select value={month} onChange={setMonth} options={monthOptions} style={{ width: 140 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : stats.length === 0 ? (
        <Empty description="本月暂无数据" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* 支出统计 */}
          <div>
            <h3 style={{ marginBottom: 12, color: '#ff4d4f' }}>💸 支出：{formatCurrency(totalExpense)}</h3>
            {expenseStats.map((s, i) => (
              <div key={s.categoryId} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{s.parentIcon} {s.parentName} / {s.categoryName}</span>
                  <span style={{ fontWeight: 500 }}>{formatCurrency(Number(s.total))}</span>
                </div>
                <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${totalExpense > 0 ? (Number(s.total) / totalExpense) * 100 : 0}%`,
                    background: colors[i % colors.length],
                    borderRadius: 4,
                    transition: 'width 0.5s'
                  }} />
                </div>
              </div>
            ))}
            {expenseStats.length === 0 && <div style={{ color: '#ccc' }}>本月无支出记录</div>}
          </div>

          {/* 收入统计 */}
          <div>
            <h3 style={{ marginBottom: 12, color: '#52c41a' }}>💰 收入：{formatCurrency(totalIncome)}</h3>
            {incomeStats.map((s, i) => (
              <div key={s.categoryId} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span>{s.categoryName}</span>
                  <span style={{ fontWeight: 500 }}>{formatCurrency(Number(s.total))}</span>
                </div>
                <div style={{ height: 8, background: '#f0f0f0', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${totalIncome > 0 ? (s.total / totalIncome) * 100 : 0}%`,
                    background: colors[(i + 5) % colors.length],
                    borderRadius: 4,
                    transition: 'width 0.5s'
                  }} />
                </div>
              </div>
            ))}
            {incomeStats.length === 0 && <div style={{ color: '#ccc' }}>本月无收入记录</div>}
          </div>
        </div>
      )}
    </div>
  )
}

export default Statistics
