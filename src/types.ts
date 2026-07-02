/**
 * 全局 API 类型定义
 * 声明 window.api 上的所有可用方法
 */
export interface Category {
  id: number
  name: string
  icon: string
  parentId: number | null
  sortOrder: number
  isDefault: number
}

export interface RecordItem {
  id: number
  type: 'expense' | 'income'
  amount: number
  category_id: number
  category_name: string
  category_icon: string
  parent_name: string
  parent_icon: string
  record_date: string
  note: string
  created_at: string
}

export interface Budget {
  id: number
  year: number
  month: number
  amount: number
}

export interface MonthlyStat {
  parentId: number
  parentName: string
  parentIcon: string
  categoryId: number
  categoryName: string
  categoryIcon: string
  type: 'expense' | 'income'
  total: number
}

export interface ApiResult<T = any> {
  success: boolean
  data?: T
  error?: string
}

/** 声明 window.api 类型 */
declare global {
  interface Window {
    api: {
      getCategories: () => Promise<ApiResult<Category[]>>
      addCategory: (cat: { name: string; icon?: string; parentId?: number }) => Promise<ApiResult<{ id: number }>>
      updateCategory: (cat: { id: number; name: string; icon?: string }) => Promise<ApiResult>
      deleteCategory: (id: number) => Promise<ApiResult>

      addRecord: (record: { type: string; amount: number; categoryId: number; recordDate: string; note?: string }) => Promise<ApiResult<{ id: number }>>
      getRecords: (filters?: { startDate?: string; endDate?: string; type?: string; categoryId?: number }) => Promise<ApiResult<RecordItem[]>>
      deleteRecord: (id: number) => Promise<ApiResult>

      getBudget: (year: number, month: number) => Promise<ApiResult<Budget>>
      setBudget: (budget: { year: number; month: number; amount: number }) => Promise<ApiResult>

      getMonthlyStats: (year: number, month: number) => Promise<ApiResult<MonthlyStat[]>>
    }
  }
}
