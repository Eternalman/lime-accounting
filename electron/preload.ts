/**
 * 预加载脚本
 * 在主进程和渲染进程之间建立安全的通信桥梁
 * 渲染进程只能调用这里暴露的 API，无法直接访问 Node.js 或数据库
 *
 * 安全配置（由主进程 webPreferences 控制）：
 *   contextIsolation: true  — 渲染进程与主进程上下文隔离
 *   nodeIntegration: false   — 渲染进程无法使用 Node.js API
 */

const { contextBridge, ipcRenderer } = require('electron')

/**
 * 封装 IPC 调用
 * 将渲染进程的 API 调用转发到主进程对应的 IPC handler
 * 返回值格式由主进程 handle() 统一封装为 { success: boolean; data?: any; error?: string }
 */
function invoke(channel: string, ...args: any[]): Promise<any> {
  return ipcRenderer.invoke(channel, ...args)
}

// 向渲染进程暴露安全的 API 接口（挂载到 window.api）
contextBridge.exposeInMainWorld('api', {
  // ======== 分类 ========
  getCategories: () =>
    invoke('db:getCategories'),
  addCategory: (cat: { name: string; icon?: string; parentId?: number }) =>
    invoke('db:addCategory', cat),
  updateCategory: (cat: { id: number; name: string; icon?: string }) =>
    invoke('db:updateCategory', cat),
  deleteCategory: (id: number) =>
    invoke('db:deleteCategory', id),

  // ======== 记录 ========
  addRecord: (record: { type: string; amount: number; categoryId: number; recordDate: string; note?: string }) =>
    invoke('db:addRecord', record),
  getRecords: (filters?: { startDate?: string; endDate?: string; type?: string; categoryId?: number }) =>
    invoke('db:getRecords', filters || {}),
  deleteRecord: (id: number) =>
    invoke('db:deleteRecord', id),

  // ======== 预算 ========
  getBudget: (year: number, month: number) =>
    invoke('db:getBudget', year, month),
  setBudget: (budget: { year: number; month: number; amount: number }) =>
    invoke('db:setBudget', budget),

  // ======== 统计 ========
  getMonthlyStats: (year: number, month: number) =>
    invoke('db:getMonthlyStats', year, month)
})