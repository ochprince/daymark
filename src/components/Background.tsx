/** 背景装饰层：极光光晕 + 颗粒噪点，纯 CSS，不参与交互 */
export function Background() {
  return (
    <div className="bg" aria-hidden="true">
      <div className="bg__glow bg__glow--1" />
      <div className="bg__glow bg__glow--2" />
      <div className="bg__glow bg__glow--3" />
      <div className="bg__grain" />
    </div>
  )
}
