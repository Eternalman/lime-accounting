/**
 * 公共 Hook — 生成本月往前 12 个月的选项列表
 * 用于 Budget、RecordList、Statistics 等页面的月份选择器
 */
import { useMemo } from 'react'
import dayjs from 'dayjs'

/** 返回最近 12 个月的 { label, value } 选项数组 */
export function useMonthOptions() {
  return useMemo(() => {
    const opts: { label: string; value: string }[] = []
    for (let i = 0; i < 12; i++) {
      const d = dayjs().subtract(i, 'month')
      opts.push({ label: d.format('YYYY年M月'), value: d.format('YYYY-MM') })
    }
    return opts
  }, [])
}
