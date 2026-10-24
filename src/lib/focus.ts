/**
 * 焦点：今天页上当前被放大的那件事。
 * 存的是 ItemView 的 key（`since:xxx` / `habit:xxx` / `countdown:xxx`），不是序号，
 * 所以删掉一件事、调换顺序都不会串。
 */
import { createJsonStore } from './jsonStore'

export const focusStore = createJsonStore<string>({
  key: 'daymark.focus.v1',
  normalize: (value) => (typeof value === 'string' ? value : ''),
})

export const subscribeFocus = focusStore.subscribe
export const getFocusKey = focusStore.get
export const setFocusKey = focusStore.set
