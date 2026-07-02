/**
 * 预加载脚本（纯 JavaScript）
 * 在渲染进程和主进程之间建立安全的通信桥梁
 */
const { contextBridge, ipcRenderer } = require('electron')

// 封装 IPC 调用
function invoke(channel, ...args) {
  return ipcRenderer.invoke(channel, ...args)
}

contextBridge.exposeInMainWorld('api', {
  // 分类
  getCategories: () => invoke('db:getCategories'),
  addCategory: (cat) => invoke('db:addCategory', cat),
  updateCategory: (cat) => invoke('db:updateCategory', cat),
  deleteCategory: (id) => invoke('db:deleteCategory', id),

  // 记录
  addRecord: (record) => invoke('db:addRecord', record),
  getRecords: (filters) => invoke('db:getRecords', filters || {}),
  deleteRecord: (id) => invoke('db:deleteRecord', id),

  // 预算
  getBudget: (year, month) => invoke('db:getBudget', year, month),
  setBudget: (budget) => invoke('db:setBudget', budget),

  // 统计
  getMonthlyStats: (year, month) => invoke('db:getMonthlyStats', year, month)
})
