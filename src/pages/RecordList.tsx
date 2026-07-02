/**
 * 记录列表页面
 * 展示所有收支记录，支持按类型、月份、分类筛选
 * 支持删除记录
 */
import React, { useState, useEffect, useMemo } from 'react'
import { App, Table, Select, Tag, Popconfirm, Empty, Tabs } from 'antd'
import { DeleteOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Category, RecordItem } from '../types'

interface Props {
  categories: Category[]
  initialFilter?: { tab?: string; month?: string }
}

const RecordList: React.FC<Props> = ({ categories, initialFilter }) => {
  const { message } = App.useApp()
  const [records, setRecords] = useState<RecordItem[]>([])
  const [loading, setLoading] = useState(false)
  const [filterTab, setFilterTab] = useState<string>(initialFilter?.tab || 'all')
  const [filterMonth, setFilterMonth] = useState<string>(
    initialFilter?.month || dayjs().format('YYYY-MM')
  )

  /** 加载记录 */
  const loadRecords = async () => {
    setLoading(true)
    try {
      const [y, m] = filterMonth.split('-').map(Number)
      const res = await window.api.getRecords({
        startDate: `${filterMonth}-01`,
        endDate: dayjs(`${filterMonth}-01`).endOf('month').format('YYYY-MM-DD'),
        type: filterTab !== 'all' ? filterTab : undefined
      })
      if (res?.success) setRecords(res.data || [])
    } catch (err: any) {
      console.error('加载记录失败:', err)
      message.error('加载失败: ' + (err.message || '未知错误'))
    }
    setLoading(false)
  }

  useEffect(() => { loadRecords() }, [filterTab, filterMonth])

  /** 删除记录 */
  const handleDelete = async (id: number) => {
    const res = await window.api.deleteRecord(id)
    if (res.success) {
      message.success('已删除')
      loadRecords()
    } else {
      message.error('删除失败')
    }
  }

  /** 生成本月月份列表 */
  const monthOptions = useMemo(() => {
    const options = []
    for (let i = 0; i < 12; i++) {
      const d = dayjs().subtract(i, 'month')
      options.push({ label: d.format('YYYY年M月'), value: d.format('YYYY-MM') })
    }
    return options
  }, [])

  /** 当月汇总 */
  const summary = useMemo(() => {
    const expense = records.filter(r => r.type === 'expense').reduce((s, r) => s + Number(r.amount), 0)
    const income = records.filter(r => r.type === 'income').reduce((s, r) => s + Number(r.amount), 0)
    return { expense, income, balance: income - expense }
  }, [records])

  const columns = [
    {
      title: '日期',
      dataIndex: 'record_date',
      key: 'date',
      width: 100,
      render: (d: string) => dayjs(d).format('MM/DD')
    },
    {
      title: '分类',
      key: 'category',
      width: 160,
      render: (_: any, r: RecordItem) => (
        <Tag color="green">{r.parent_icon} {r.parent_name} / {r.category_name}</Tag>
      )
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amt: number, r: RecordItem) => (
          <span style={{
            color: r.type === 'expense' ? '#ff4d4f' : '#52c41a', fontWeight: 600, fontSize: 16
          }}>
            {r.type === 'expense' ? '-' : '+'}¥{Number(amt).toFixed(2)}
          </span>
      )
    },
    {
      title: '备注',
      dataIndex: 'note',
      key: 'note',
      render: (n: string) => n || <span style={{ color: '#ccc' }}>—</span>
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_: any, r: RecordItem) => (
        <Popconfirm title="确认删除这条记录？" onConfirm={() => handleDelete(r.id)} okText="删除" cancelText="取消">
          <DeleteOutlined style={{ color: '#ff4d4f', cursor: 'pointer' }} />
        </Popconfirm>
      )
    }
  ]

  return (
    <div>
      {/* 顶部筛选栏 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Tabs
          activeKey={filterTab}
          onChange={setFilterTab}
          style={{ marginBottom: 0 }}
          items={[
            { key: 'all', label: '全部' },
            { key: 'expense', label: '💸 支出' },
            { key: 'income', label: '💰 收入' }
          ]}
        />
        <Select
          value={filterMonth}
          onChange={setFilterMonth}
          options={monthOptions}
          style={{ width: 140 }}
        />
      </div>

      {/* 月度汇总卡片 */}
      <div style={{
        display: 'flex', gap: 16, marginBottom: 16,
        padding: 16, background: '#f9fafb', borderRadius: 8
      }}>
        <div>
          <span style={{ color: '#999' }}>支出：</span>
          <span style={{ color: '#ff4d4f', fontWeight: 600, fontSize: 16 }}>¥{summary.expense.toFixed(2)}</span>
        </div>
        <div>
          <span style={{ color: '#999' }}>收入：</span>
          <span style={{ color: '#52c41a', fontWeight: 600, fontSize: 16 }}>¥{summary.income.toFixed(2)}</span>
        </div>
        <div>
          <span style={{ color: '#999' }}>结余：</span>
          <span style={{
            color: summary.balance >= 0 ? '#52c41a' : '#ff4d4f',
            fontWeight: 600, fontSize: 16
          }}>
            ¥{summary.balance.toFixed(2)}
          </span>
        </div>
      </div>

      {/* 记录表格 */}
      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={loading}
        locale={{ emptyText: <Empty description="本月暂无记录，快去记一笔吧！" /> }}
        pagination={{ pageSize: 20, showTotal: t => `共 ${t} 条` }}
        size="middle"
      />
    </div>
  )
}

export default RecordList
