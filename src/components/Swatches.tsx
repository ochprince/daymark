import type { CSSProperties } from 'react'
import { PALETTE } from '../lib/palette'
import { CheckIcon } from './icons'

type Props = {
  value: number
  onChange: (index: number) => void
}

export function Swatches({ value, onChange }: Props) {
  return (
    <div className="swatches" role="radiogroup" aria-label="标记颜色">
      {PALETTE.map((accent, index) => (
        <button
          key={accent.id}
          type="button"
          className="swatch"
          role="radio"
          aria-checked={index === value}
          aria-label={accent.name}
          data-selected={index === value}
          style={
            {
              '--swatch-from': accent.from,
              '--swatch-to': accent.to,
            } as CSSProperties
          }
          onClick={() => onChange(index)}
        >
          <span className="swatch__dot">
            {index === value ? (
              <span className="swatch__check">
                <CheckIcon />
              </span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  )
}
