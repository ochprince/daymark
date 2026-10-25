/**
 * 倒数日详情里的「一句备忘 + 待办清单」。
 *
 * 纯展示 + 回调，不碰 storage：主控拿到 onMemo / onTodo 之后往
 * patchCountdown(id, { memo }) / patchCountdown(id, { todo }) 里塞就行。
 *
 *   <CountdownNotes
 *     memo={event.memo ?? ''}
 *     todo={event.todo ?? []}
 *     onMemo={(memo) => patchCountdown(event.id, { memo })}
 *     onTodo={(todo) => patchCountdown(event.id, { todo })}
 *   />
 *
 * 备忘没有保存按钮：失焦就存，Esc 退回上一次存下的内容。
 */
import { useEffect, useId, useRef, useState } from 'react'
import { t } from '../lib/i18n'
import {
  addTodo,
  cleanTodoText,
  MEMO_TEXT_MAX,
  normalizeTodo,
  removeTodo,
  TODO_TEXT_MAX,
  todoId,
  todoProgress,
  toggleTodo,
} from '../lib/todo'
import type { TodoItem } from '../lib/types'
import { IconCheck, IconClose, IconPlus } from './icons'
import './notes.css'

export type CountdownNotesProps = {
  /** 一句备忘；没写过就是空串 */
  memo: string
  /** 待办清单；脏数据在这里收敛，不会渲染出半截条目 */
  todo: TodoItem[]
  onMemo: (text: string) => void
  onTodo: (next: TodoItem[]) => void
}

export function CountdownNotes({ memo, todo, onMemo, onTodo }: CountdownNotesProps) {
  const memoFieldId = useId()
  const todoFieldId = useId()
  const [draft, setDraft] = useState(memo)
  const [adding, setAdding] = useState('')
  /** Esc 已经把这轮输入退回去了，失焦时不要再存一次 */
  const skipCommit = useRef(false)

  // 外面改了（同步、撤销、切到另一件事），输入框跟着走
  useEffect(() => {
    setDraft(memo)
  }, [memo])

  const items = normalizeTodo(todo)
  const progress = todoProgress(items)
  const canAdd = cleanTodoText(adding) !== ''

  const commitMemo = () => {
    const next = cleanTodoText(draft, MEMO_TEXT_MAX)
    if (next !== draft) setDraft(next)
    if (next !== cleanTodoText(memo, MEMO_TEXT_MAX)) onMemo(next)
  }

  const submitTodo = () => {
    const next = addTodo(items, adding)
    setAdding('')
    // 空文本 / 重名 / 清单满了：addTodo 原样返回，什么都不写
    if (next !== items) onTodo(next)
  }

  return (
    <section className="cnote">
      <div className="cnote-block">
        <label className="cnote-label" htmlFor={memoFieldId}>
          {t('notes.memo')}
        </label>
        <input
          id={memoFieldId}
          className="cnote-memo"
          type="text"
          autoComplete="off"
          maxLength={MEMO_TEXT_MAX}
          placeholder={t('notes.memo.ph')}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={() => {
            if (skipCommit.current) {
              skipCommit.current = false
              return
            }
            commitMemo()
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            } else if (event.key === 'Escape') {
              skipCommit.current = true
              setDraft(memo)
              event.currentTarget.blur()
            }
          }}
        />
      </div>

      <div className="cnote-block">
        <div className="cnote-head">
          <label className="cnote-label" htmlFor={todoFieldId}>
            {t('notes.todo')}
          </label>
          {progress.total > 0 ? (
            <span className="cnote-progress">
              {t('notes.todo.done', { done: progress.done, total: progress.total })}
            </span>
          ) : null}
        </div>

        <div className="cnote-add">
          <input
            id={todoFieldId}
            className="cnote-input"
            type="text"
            autoComplete="off"
            maxLength={TODO_TEXT_MAX}
            placeholder={t('notes.todo.ph')}
            value={adding}
            onChange={(event) => setAdding(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                submitTodo()
              } else if (event.key === 'Escape') {
                setAdding('')
              }
            }}
          />
          <button className="cnote-add-btn" type="button" onClick={submitTodo} disabled={!canAdd}>
            <IconPlus size={13} />
            {t('notes.todo.add')}
          </button>
        </div>

        {items.length === 0 ? (
          <p className="cnote-empty">{t('notes.todo.empty')}</p>
        ) : (
          <ul className="cnote-list">
            {items.map((item, index) => (
              <li className={item.done ? 'cnote-item is-done' : 'cnote-item'} key={todoId(index)}>
                <label className="cnote-check">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => onTodo(toggleTodo(items, index))}
                  />
                  <span className="cnote-box" aria-hidden="true">
                    <IconCheck size={11} />
                  </span>
                  <span className="cnote-text">{item.text}</span>
                </label>
                <button
                  className="cnote-del"
                  type="button"
                  aria-label={t('notes.remove')}
                  title={t('notes.remove')}
                  onClick={() => onTodo(removeTodo(items, index))}
                >
                  <IconClose size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
