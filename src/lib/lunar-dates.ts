/**
 * 农历节日对应的公历日期（MM-DD），按农历年索引。
 *
 * 由脚本从浏览器 ICU 的 Chinese 日历一次性导出，运行时不再依赖平台的农历实现，
 * 覆盖农历 2026–2051 年；超出范围的年份会退回用 Intl 现场计算。
 * 除夕 = 下一年正月初一的前一天，由 chunjie 推导，不单独存。
 */
export const LUNAR_FESTIVAL_DATES: Record<number, Record<string, string>> = {
  2026: { chongyang: '10-18', chunjie: '02-17', duanwu: '06-19', laba: '01-15', longtaitou: '03-20', qixi: '08-19', xiaonian: '01-30', yuanxiao: '03-03', zhongqiu: '09-25', zhongyuan: '08-27' },
  2027: { chongyang: '10-08', chunjie: '02-07', duanwu: '06-09', laba: '01-04', longtaitou: '03-09', qixi: '08-08', xiaonian: '01-19', yuanxiao: '02-21', zhongqiu: '09-15', zhongyuan: '08-16' },
  2028: { chongyang: '10-26', chunjie: '01-26', duanwu: '05-28', laba: '01-22', longtaitou: '02-26', qixi: '08-26', xiaonian: '02-06', yuanxiao: '02-09', zhongqiu: '10-03', zhongyuan: '09-03' },
  2029: { chongyang: '10-16', chunjie: '02-13', duanwu: '06-16', laba: '01-11', longtaitou: '03-16', qixi: '08-16', xiaonian: '01-26', yuanxiao: '02-27', zhongqiu: '09-22', zhongyuan: '08-24' },
  2030: { chongyang: '10-05', chunjie: '02-02', duanwu: '06-05', laba: '01-01', longtaitou: '03-05', qixi: '08-05', xiaonian: '01-16', yuanxiao: '02-16', zhongqiu: '09-12', zhongyuan: '08-13' },
  2031: { chongyang: '10-24', chunjie: '01-23', duanwu: '06-24', laba: '01-20', longtaitou: '02-22', qixi: '08-24', xiaonian: '02-04', yuanxiao: '02-06', zhongqiu: '10-01', zhongyuan: '09-01' },
  2032: { chongyang: '10-12', chunjie: '02-11', duanwu: '06-12', laba: '01-08', longtaitou: '03-13', qixi: '08-12', xiaonian: '01-23', yuanxiao: '02-25', zhongqiu: '09-19', zhongyuan: '08-20' },
  2033: { chongyang: '10-01', chunjie: '01-31', duanwu: '06-01', laba: '01-27', longtaitou: '03-02', qixi: '08-01', xiaonian: '02-11', yuanxiao: '02-14', zhongqiu: '09-08', zhongyuan: '08-09' },
  2034: { chongyang: '10-20', chunjie: '02-19', duanwu: '06-20', laba: '01-16', longtaitou: '03-21', qixi: '08-20', xiaonian: '01-31', yuanxiao: '03-05', zhongqiu: '09-27', zhongyuan: '08-28' },
  2035: { chongyang: '10-09', chunjie: '02-08', duanwu: '06-10', laba: '01-05', longtaitou: '03-11', qixi: '08-10', xiaonian: '01-20', yuanxiao: '02-22', zhongqiu: '09-16', zhongyuan: '08-18' },
  2036: { chongyang: '10-27', chunjie: '01-28', duanwu: '05-30', laba: '01-23', longtaitou: '02-28', qixi: '08-28', xiaonian: '02-07', yuanxiao: '02-11', zhongqiu: '10-04', zhongyuan: '09-05' },
  2037: { chongyang: '10-17', chunjie: '02-15', duanwu: '06-18', laba: '01-12', longtaitou: '03-18', qixi: '08-17', xiaonian: '01-27', yuanxiao: '03-01', zhongqiu: '09-24', zhongyuan: '08-25' },
  2038: { chongyang: '10-07', chunjie: '02-04', duanwu: '06-07', laba: '01-02', longtaitou: '03-07', qixi: '08-07', xiaonian: '01-17', yuanxiao: '02-18', zhongqiu: '09-13', zhongyuan: '08-15' },
  2039: { chongyang: '10-26', chunjie: '01-24', duanwu: '05-27', laba: '01-21', longtaitou: '02-24', qixi: '08-26', xiaonian: '02-05', yuanxiao: '02-07', zhongqiu: '10-02', zhongyuan: '09-03' },
  2040: { chongyang: '10-14', chunjie: '02-12', duanwu: '06-14', laba: '01-10', longtaitou: '03-14', qixi: '08-14', xiaonian: '01-25', yuanxiao: '02-26', zhongqiu: '09-20', zhongyuan: '08-22' },
  2041: { chongyang: '10-03', chunjie: '02-01', duanwu: '06-03', laba: '12-30', longtaitou: '03-03', qixi: '08-03', xiaonian: '01-14', yuanxiao: '02-15', zhongqiu: '09-10', zhongyuan: '08-11' },
  2042: { chongyang: '10-22', chunjie: '01-22', duanwu: '06-22', laba: '01-18', longtaitou: '02-21', qixi: '08-22', xiaonian: '02-02', yuanxiao: '02-05', zhongqiu: '09-28', zhongyuan: '08-30' },
  2043: { chongyang: '10-11', chunjie: '02-10', duanwu: '06-11', laba: '01-07', longtaitou: '03-12', qixi: '08-11', xiaonian: '01-22', yuanxiao: '02-24', zhongqiu: '09-17', zhongyuan: '08-19' },
  2044: { chongyang: '10-29', chunjie: '01-30', duanwu: '05-31', laba: '01-25', longtaitou: '03-01', qixi: '07-31', xiaonian: '02-09', yuanxiao: '02-13', zhongqiu: '10-05', zhongyuan: '08-08' },
  2045: { chongyang: '10-18', chunjie: '02-17', duanwu: '06-19', laba: '01-14', longtaitou: '03-20', qixi: '08-19', xiaonian: '01-29', yuanxiao: '03-03', zhongqiu: '09-25', zhongyuan: '08-27' },
  2046: { chongyang: '10-08', chunjie: '02-06', duanwu: '06-08', laba: '01-03', longtaitou: '03-09', qixi: '08-08', xiaonian: '01-18', yuanxiao: '02-20', zhongqiu: '09-15', zhongyuan: '08-16' },
  2047: { chongyang: '10-27', chunjie: '01-26', duanwu: '05-29', laba: '01-22', longtaitou: '02-26', qixi: '08-27', xiaonian: '02-06', yuanxiao: '02-09', zhongqiu: '10-04', zhongyuan: '09-04' },
  2048: { chongyang: '10-16', chunjie: '02-14', duanwu: '06-15', laba: '01-11', longtaitou: '03-15', qixi: '08-16', xiaonian: '01-26', yuanxiao: '02-28', zhongqiu: '09-22', zhongyuan: '08-24' },
  2049: { chongyang: '10-05', chunjie: '02-02', duanwu: '06-04', laba: '01-01', longtaitou: '03-05', qixi: '08-05', xiaonian: '01-16', yuanxiao: '02-16', zhongqiu: '09-11', zhongyuan: '08-13' },
  2050: { chongyang: '10-24', chunjie: '01-23', duanwu: '06-23', laba: '01-20', longtaitou: '02-22', qixi: '08-23', xiaonian: '02-04', yuanxiao: '02-06', zhongqiu: '09-30', zhongyuan: '08-31' },
  2051: { chongyang: '10-13', chunjie: '02-11', duanwu: '06-13', laba: '01-09', longtaitou: '03-14', qixi: '08-12', xiaonian: '01-24', yuanxiao: '02-25', zhongqiu: '09-19', zhongyuan: '08-20' },
}
