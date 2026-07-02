/**
 * 分类管理页面
 * 用户可以查看、添加、修改、删除自定义分类
 * 系统默认分类不可删除
 */
import React, { useState, useMemo } from 'react'
import { Button, Modal, Input, Popconfirm, message, Empty, Tag, Tabs } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'
import type { Category } from '../types'

interface Props {
  categories: Category[]
  onChanged: () => void
}

const CategoryManage: React.FC<Props> = ({ categories, onChanged }) => {
  const [modalOpen, setModalOpen] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('')
  const [parentId, setParentId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'expense' | 'income'>('expense')

  // 一级分类
  const parentCats = useMemo(() =>
    categories.filter(c => c.parentId === null && (
      tab === 'expense' ? c.name !== '收入' : c.name === '收入'
    )),
    [categories, tab]
  )

  /** 打开新增弹窗 */
  const openAdd = (pid: number | null) => {
    setEditId(null)
    setName('')
    setIcon('')
    setParentId(pid)
    setModalOpen(true)
  }

  /** 打开编辑弹窗 */
  const openEdit = (cat: Category) => {
    setEditId(cat.id)
    setName(cat.name)
    setIcon(cat.icon)
    setParentId(cat.parentId)
    setModalOpen(true)
  }

  /** 保存分类 */
  const handleSave = async () => {
    if (!name.trim()) {
      message.warning('请输入分类名称')
      return
    }
    setSaving(true)
    let res
    if (editId) {
      res = await window.api.updateCategory({ id: editId, name: name.trim(), icon: icon.trim() })
    } else {
      res = await window.api.addCategory({ name: name.trim(), icon: icon.trim(), parentId })
    }
    setSaving(false)
    if (res.success) {
      message.success(editId ? '修改成功' : '添加成功')
      setModalOpen(false)
      onChanged()
    } else {
      message.error(res.error || '操作失败')
    }
  }

  /** 删除分类 */
  const handleDelete = async (id: number) => {
    const res = await window.api.deleteCategory(id)
    if (res.success) {
      message.success('已删除')
      onChanged()
    } else {
      message.error(res.error || '删除失败（系统默认分类不可删除）')
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Tabs
          activeKey={tab}
          onChange={v => setTab(v as 'expense' | 'income')}
          items={[
            { key: 'expense', label: '💸 支出分类' },
            { key: 'income', label: '💰 收入分类' }
          ]}
        />
      </div>

      {parentCats.map(parent => {
        const children = categories.filter(c => c.parentId === parent.id)
        return (
          <div key={parent.id} style={{ marginBottom: 24 }}>
            {/* 一级分类标题 */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0', borderBottom: '2px solid #7ed321', marginBottom: 8
            }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>
                {parent.icon} {parent.name}
              </span>
              <Button
                type="link" size="small" icon={<PlusOutlined />}
                onClick={() => openAdd(parent.id)}
              >
                添加小类
              </Button>
            </div>
            {/* 二级分类列表 */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingLeft: 16 }}>
              {children.map(child => (
                <Tag
                  key={child.id}
                  color={child.isDefault ? 'green' : 'blue'}
                  closable={child.isDefault === 0}
                  onClose={() => handleDelete(child.id)}
                  style={{ padding: '4px 12px', fontSize: 13, cursor: 'pointer', marginBottom: 8 }}
                  onClick={() => child.isDefault === 0 && openEdit(child)}
                >
                  {child.name}
                  {child.isDefault === 0 && <EditOutlined style={{ marginLeft: 4, fontSize: 10 }} />}
                </Tag>
              ))}
              {children.length === 0 && (
                <span style={{ color: '#ccc' }}>暂无子分类</span>
              )}
            </div>
          </div>
        )
      })}

      {/* 添加一级分类按钮 */}
      <div style={{ marginTop: 16 }}>
        <Button
          type="dashed" block icon={<PlusOutlined />}
          onClick={() => openAdd(null)}
        >
          添加一级分类
        </Button>
      </div>

      {/* 添加/编辑弹窗 */}
      <Modal
        title={editId ? '编辑分类' : '添加分类'}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ marginBottom: 12 }}>
          <div style={{ marginBottom: 4 }}>分类名称</div>
          <Input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="如：咖啡奶茶"
            maxLength={20}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4 }}>图标（可选，输入 emoji）</div>
          <Input
            value={icon}
            onChange={e => setIcon(e.target.value)}
            placeholder="如：☕"
            maxLength={5}
          />
        </div>
      </Modal>
    </div>
  )
}

export default CategoryManage
