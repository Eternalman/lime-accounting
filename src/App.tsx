/**
 * 青柠记账 — 应用根组件（带错误保护）
 */
import React, { useState, useEffect, useCallback, Component } from 'react'
import { App as AntdApp, ConfigProvider, Layout, Button, Result, message } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import type { Category } from './types'
import RecordForm from './pages/RecordForm'
import RecordList from './pages/RecordList'
import Statistics from './pages/Statistics'
import Budget from './pages/Budget'
import CategoryManage from './pages/CategoryManage'
import './styles/global.css'

const { Header, Content, Footer } = Layout

/** 错误边界 — 防止整个APP崩溃 */
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean; errorMsg: string }> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false, errorMsg: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="error"
          title="页面出错了"
          subTitle={this.state.errorMsg}
          extra={<Button type="primary" onClick={() => this.setState({ hasError: false })}>重试</Button>}
        />
      )
    }
    return this.props.children
  }
}

const App: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([])
  const [activeTab, setActiveTab] = useState('record')
  const [recordFilter, setRecordFilter] = useState<{ tab?: string; month?: string }>({})

  const loadCategories = useCallback(async () => {
    try {
      const res = await window.api?.getCategories?.()
      if (res?.success) setCategories(res.data!)
    } catch (err: any) {
      console.error('加载分类失败:', err)
    }
  }, [])

  useEffect(() => { loadCategories() }, [loadCategories])

  const onRecorded = (recordType: string) => {
    message.success('记账成功！')
    setRecordFilter({ tab: recordType })
    setActiveTab('history')
  }

  const tabItems = [
    { key: 'record', label: '📝 记账' },
    { key: 'history', label: '📋 记录' },
    { key: 'stats', label: '📊 统计' },
    { key: 'budget', label: '💰 预算' },
    { key: 'category', label: '⚙️ 分类' }
  ]

  return (
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#7ed321', borderRadius: 8 } }}>
      <AntdApp>
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{
          background: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center',
          borderBottom: '1px solid #e8e8e8', height: 56, position: 'sticky', top: 0, zIndex: 100
        }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#7ed321', marginRight: 40 }}>
            🍋 青柠记账
          </h1>
          <div style={{ display: 'flex', gap: 4 }}>
            {tabItems.map(item => (
              <button key={item.key} onClick={() => setActiveTab(item.key)} style={{
                padding: '8px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 15,
                fontWeight: activeTab === item.key ? 600 : 400,
                background: activeTab === item.key ? '#7ed321' : 'transparent',
                color: activeTab === item.key ? '#fff' : '#555',
                transition: 'all 0.2s'
              }}>
                {item.label}
              </button>
            ))}
          </div>
        </Header>

        <Content style={{ padding: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, minHeight: 500 }}>
            <ErrorBoundary>
              {activeTab === 'record' && <RecordForm categories={categories} onRecorded={onRecorded} />}
              {activeTab === 'history' && <RecordList categories={categories} initialFilter={recordFilter} />}
              {activeTab === 'stats' && <Statistics categories={categories} />}
              {activeTab === 'budget' && <Budget />}
              {activeTab === 'category' && <CategoryManage categories={categories} onChanged={loadCategories} />}
            </ErrorBoundary>
          </div>
        </Content>

        <Footer style={{ textAlign: 'center', color: '#999', background: '#f5f7fa' }}>
          青柠记账 © 2026 — 用 Claude Code 辅助开发
        </Footer>
      </Layout>
      </AntdApp>
    </ConfigProvider>
  )
}

export default App
