/**
 * 记账表单页面
 * 用户在这里输入金额、选择分类、填写备注，提交记账
 * 支持支出和收入两种类型
 */
import React, { useState, useMemo } from 'react'
import { App, Button, Input, Select, DatePicker, InputNumber, Radio } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Category } from '../types'

const { TextArea } = Input

interface Props {
  categories: Category[]
  onRecorded: (type: string) => void
}

const RecordForm: React.FC<Props> = ({ categories, onRecorded }) => {
  const { message } = App.useApp()
  const [recordType, setRecordType] = useState<'expense' | 'income'>('expense')
  const [amount, setAmount] = useState<number | null>(null)
  const [parentId, setParentId] = useState<number | null>(null)
  const [categoryId, setCategoryId] = useState<number | null>(null)
  const [recordDate, setRecordDate] = useState<string>(dayjs().format('YYYY-MM-DD'))
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  // 一级分类列表（根据支出/收入类型筛选）
  const parentCategories = useMemo(() =>
    categories.filter(c => c.parentId === null && (
      recordType === 'expense'
        ? c.name !== '收入'          // 支出时排除"收入"分类
        : c.name === '收入'           // 收入时只显示"收入"分类
    )),
    [categories, recordType]
  )

  // 当前选中一级分类下的二级分类
  const childCategories = useMemo(() =>
    categories.filter(c => c.parentId === parentId),
    [categories, parentId]
  )

  /** 重置表单 */
  const resetForm = () => {
    setAmount(null)
    setParentId(null)
    setCategoryId(null)
    setNote('')
  }

  /** 提交记账 */
  const handleSubmit = async () => {
    if (!amount || amount <= 0) {
      message.warning('请输入金额')
      return
    }
    if (!categoryId) {
      message.warning('请选择分类')
      return
    }
    setLoading(true)
    try {
      const res = await window.api.addRecord({
        type: recordType,
        amount,
        categoryId,
        recordDate,
        note
      })
      setLoading(false)
      if (res.success) {
        resetForm()
        onRecorded(recordType)
      } else {
        message.error(res.error || '记账失败')
      }
    } catch (err: any) {
      setLoading(false)
      console.error('提交失败:', err)
      message.error('提交失败: ' + (err.message || '未知错误'))
    }
  }

  // 快捷金额列表
  const quickAmounts = [10, 20, 50, 100, 200, 500]

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 24, fontSize: 18 }}>
        {recordType === 'expense' ? '💸 记录支出' : '💰 记录收入'}
      </h2>

      {/* 支出/收入切换 */}
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Radio.Group
          value={recordType}
          onChange={e => { setRecordType(e.target.value); setParentId(null); setCategoryId(null) }}
          buttonStyle="solid"
          size="large"
        >
          <Radio.Button value="expense" style={{ padding: '0 30px' }}>💸 支出</Radio.Button>
          <Radio.Button value="income" style={{ padding: '0 30px' }}>💰 收入</Radio.Button>
        </Radio.Group>
      </div>

      {/* 金额输入 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>金额（元）</div>
        <InputNumber
          style={{ width: '100%' }}
          size="large"
          placeholder="请输入金额，例如 35.5"
          value={amount}
          onChange={setAmount}
          min={0}
          precision={2}
          prefix="¥"
          addonAfter={
            <span
              style={{ cursor: 'pointer', color: '#7ed321' }}
              onClick={() => {
                const today = dayjs().format('YYYY-MM-DD')
                const input = prompt('输入日期（格式：YYYY-MM-DD，如 ' + today + '）：', today)
                // 校验日期格式，防止非法日期存入数据库
                if (input && /^\d{4}-\d{2}-\d{2}$/.test(input) && dayjs(input).isValid()) {
                  setRecordDate(input)
                } else if (input) {
                  message.warning('日期格式不正确，请输入如 ' + today + ' 的格式')
                }
              }}
            >
              {recordDate} 📅
            </span>
          }
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {quickAmounts.map(amt => (
            <Button
              key={amt}
              size="small"
              onClick={() => setAmount(amt)}
              type={amount === amt ? 'primary' : 'default'}
            >
              ¥{amt}
            </Button>
          ))}
        </div>
      </div>

      {/* 分类选择 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>一级分类</div>
        <Select
          style={{ width: '100%' }}
          size="large"
          placeholder="选择大类"
          value={parentId}
          onChange={val => { setParentId(val); setCategoryId(null) }}
          options={parentCategories.map(c => ({
            label: `${c.icon} ${c.name}`,
            value: c.id
          }))}
        />
      </div>

      {parentId && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>二级分类</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {childCategories.map(c => (
              <Button
                key={c.id}
                onClick={() => setCategoryId(c.id)}
                type={categoryId === c.id ? 'primary' : 'default'}
                style={{ borderRadius: 20 }}
              >
                {c.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* 备注 */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>备注（可选）</div>
        <TextArea
          rows={2}
          placeholder="写点什么备注…"
          value={note}
          onChange={e => setNote(e.target.value)}
          maxLength={200}
          showCount
        />
      </div>

      {/* 提交按钮 */}
      <Button
        type="primary"
        size="large"
        block
        loading={loading}
        onClick={handleSubmit}
        style={{
          height: 48,
          fontSize: 16,
          background: recordType === 'expense' ? '#ff4d4f' : '#52c41a',
          borderColor: recordType === 'expense' ? '#ff4d4f' : '#52c41a'
        }}
        icon={<PlusOutlined />}
      >
        {recordType === 'expense' ? '记录支出' : '记录收入'}
      </Button>
    </div>
  )
}

export default RecordForm
