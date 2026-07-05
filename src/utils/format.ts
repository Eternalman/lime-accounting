/**
 * 格式化工具函数
 * 提供金额格式化等通用功能，避免在多处重复相同逻辑
 */

/** 将数字格式化为 ¥xx.xx 的金额字符串 */
export function formatCurrency(amount: number): string {
  return '¥' + (amount || 0).toFixed(2)
}
