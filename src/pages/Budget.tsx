/**
 * 预算管理页面
 * 设置月度预算，实时对比本月支出，超支时给出提醒
 */
import React, { useState, useEffect, useMemo } from 'react'
import { App, Select, InputNumber, Button, Progress, Spin } from 'antd'
import { EditOutlined, CheckOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { MonthlyStat } from '../types'

const Budget: React.FC = () => {
  const { message } = App.useApp()
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'))
  const [budget, setBudget] = useState<number | null>(null)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState<number | null>(null)
  const [stats, setStats] = useState<MonthlyStat[]>([])
  const [loading, setLoading] = useState(false)

  /** 加载预算和当月统计 */
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const [y, m] = month.split('-').map(Number)
      const [budgetRes, statsRes] = await Promise.all([
        window.api.getBudget(y, m),
        window.api.getMonthlyStats(y, m)
      ])
      if (budgetRes.success && budgetRes.data) {
        setBudget(Number(budgetRes.data.amount))
      } else {
        setBudget(null)
      }
      if (statsRes.success) setStats(statsRes.data!)
      setLoading(false)
    }
    load()
  }, [month])

  // 当月总支出
  const totalExpense = useMemo(
    () => stats.filter(s => s.type === 'expense').reduce((s, i) => s + Number(i.total), 0),
    [stats]
  )

  // 超支比例
  const percent = budget && budget > 0 ? Math.round((totalExpense / budget) * 100) : 0
  const isOverBudget = percent > 100

  /** 保存预算 */
  const handleSave = async () => {
    if (editValue === null || editValue <= 0) {
      message.warning('请输入有效的预算金额')
      return
    }
    const [y, m] = month.split('-').map(Number)
    const res = await window.api.setBudget({ year: y, month: m, amount: editValue })
    if (res.success) {
      setBudget(editValue)
      setEditing(false)
      message.success('预算已设置')
    } else {
      message.error('保存失败')
    }
  }

  const monthOptions = useMemo(() => {
    const opts = []
    for (let i = 0; i < 12; i++) {
      const d = dayjs().subtract(i, 'month')
      opts.push({ label: d.format('YYYY年M月'), value: d.format('YYYY-MM') })
    }
    return opts
  }, [])

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, margin: 0 }}>💰 预算管理</h2>
        <Select value={month} onChange={setMonth} options={monthOptions} style={{ width: 140 }} />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>
      ) : (
        <>
          {/* 预算设置卡片 */}
          <div style={{
            background: isOverBudget ? '#fff2f0' : '#f6ffed',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
            textAlign: 'center',
            border: `2px solid ${isOverBudget ? '#ff4d4f' : '#b7eb8f'}`
          }}>
            <div style={{ fontSize: 14, color: '#999', marginBottom: 8 }}>月度预算</div>
            {editing ? (
              <div>
                <InputNumber
                  size="large"
                  value={editValue}
                  onChange={setEditValue}
                  min={0}
                  precision={2}
                  prefix="¥"
                  style={{ width: 200 }}
                  autoFocus
                />
                <div style={{ marginTop: 12 }}>
                  <Button type="primary" icon={<CheckOutlined />} onClick={handleSave}>
                    保存预算
                  </Button>
                  <Button style={{ marginLeft: 8 }} onClick={() => setEditing(false)}>取消</Button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 36, fontWeight: 700, color: isOverBudget ? '#ff4d4f' : '#333' }}>
                  ¥ {(budget || 0).toFixed(2)}
                </div>
                <Button
                  type="link"
                  icon={<EditOutlined />}
                  onClick={() => { setEditValue(budget || 0); setEditing(true) }}
                  style={{ marginTop: 8 }}
                >
                  {budget ? '修改预算' : '设置预算'}
                </Button>
              </div>
            )}
          </div>

          {/* 预算使用情况 */}
          {budget && budget > 0 && (
            <div style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              border: '1px solid #e8e8e8',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 14, color: '#999', marginBottom: 16 }}>预算使用情况</div>
              <Progress
                type="dashboard"
                percent={Math.min(percent, 100)}
                format={() => `${percent}%`}
                strokeColor={percent > 80 ? (percent > 100 ? '#ff4d4f' : '#faad14') : '#7ed321'}
                size={200}
              />
              <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 32 }}>
                <div>
                  <div style={{ color: '#999', fontSize: 12 }}>已支出</div>
                  <div style={{ fontSize: 18, fontWeight: 600, color: '#ff4d4f' }}>¥{totalExpense.toFixed(2)}</div>
                </div>
                <div>
                  <div style={{ color: '#999', fontSize: 12 }}>预算余额</div>
                  <div style={{
                    fontSize: 18, fontWeight: 600,
                    color: isOverBudget ? '#ff4d4f' : '#52c41a'
                  }}>
                    ¥{(budget - totalExpense).toFixed(2)}
                  </div>
                </div>
              </div>
              {isOverBudget && (
                <div style={{
                  marginTop: 16,
                  padding: '8px 16px',
                  background: '#fff2f0',
                  borderRadius: 8,
                  color: '#ff4d4f',
                  fontWeight: 500
                }}>
                  ⚠️ 本月已超支 ¥{(totalExpense - budget).toFixed(2)}，请注意控制花销！
                </div>
              )}
            </div>
          )}

          {!budget && (
            <div style={{ textAlign: 'center', padding: 40, color: '#ccc' }}>
              尚未设置本月预算，点击上方按钮进行设置
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default Budget
