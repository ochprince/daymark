import { Sheet } from './Sheet'
import { CHECKIN_PRESETS, CADENCE_OPTIONS } from '../lib/checkins'
import type { CheckInPreset } from '../lib/checkins'

type Props = {
  onClose: () => void
  /** 挑了一个常用事件：直接建好 */
  onPick: (preset: CheckInPreset) => void
  /** 不在列表里，自己写 */
  onCustom: () => void
}

function cadenceLabel(preset: CheckInPreset): string {
  return CADENCE_OPTIONS.find((option) => option.value === preset.cadence)?.label ?? ''
}

/**
 * 「一点点积累」的添加入口：先给常用事件，挑一下就好；
 * 想记别的事再走自定义表单。常用项里喝水、跑步带音效。
 */
export function CheckInPresetSheet({ onClose, onPick, onCustom }: Props) {
  return (
    <Sheet label="要记哪件事" onClose={onClose}>
      <h2 className="sheet__title">要记哪件事</h2>
      <p className="sheet__sub">常见的事挑一个就好，点一下直接建好；不在这里，就自己写一件。</p>

      <div className="presets">
        {CHECKIN_PRESETS.map((preset) => (
          <button
            key={preset.title}
            type="button"
            className="preset"
            data-sfx={preset.sfx ? 'true' : undefined}
            onClick={() => onPick(preset)}
          >
            <span className="preset__name">{preset.title}</span>
            <span className="preset__hint">{cadenceLabel(preset)}</span>
          </button>
        ))}
      </div>

      <button type="button" className="preset preset--custom" onClick={onCustom}>
        <span className="preset__name">自定义</span>
        <span className="preset__hint">自己写名称和周期</span>
      </button>
    </Sheet>
  )
}
