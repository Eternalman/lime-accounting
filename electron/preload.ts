/**
 * 预加载脚本
 * 在主进程和渲染进程之间建立安全的通信桥梁
 * 渲染进程只能调用这里暴露的 API，无法直接访问 Node.js 或数据库
 */
const { contextBridge, ipcRenderer } = require('electron')

/** 封装 IPC 调用 */
function invoke<T = any>(channel: string, ...args: any[]): Promise<{ success: boolean; data?: T; error?: string }> {
  return ipcRenderer.invoke(channel, ...args)
}

// 向渲染进程暴露安全的 API
contextBridge.exposeInMainWorld('api', {
  /** 分类相关 */
  getCategories: () => invoke('db:getCategories'),
  addCategory: (cat: { name: string; icon?: string; parentId?: number }) =>
    invoke('db:addCategory', cat),
  updateCategory: (cat: { id: number; name: string; icon?: string }) =>
    invoke('db:updateCategory', cat),
  deleteCategory: (id: number) => invoke('db:deleteCategory', id),

  /** 记录相关 */
  addRecord: (record: { type: string; amount: number; categoryId: number; recordDate: string; note?: string }) =>
    invoke('db:addRecord', record),
  getRecords: (filters?: { startDate?: string; endDate?: string; type?: string; categoryId?: number }) =>
    invoke('db:getRecords', filters || {}),
  deleteRecord: (id: number) => invoke('db:deleteRecord', id),

  /** 预算相关 */
  getBudget: (year: number, month: number) => invoke('db:getBudget', year, month),
  setBudget: (budget: { year: number; month: number; amount: number }) =>
    invoke('db:setBudget', budget),

  /** 统计相关 */
  getMonthlyStats: (year: number, month: number) => invoke('db:getMonthlyStats', year, month)
})
