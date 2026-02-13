import Icon from './Icon'

export default function AppLogo() {
  return (
    <div className="flex items-center gap-2 ">
      <Icon name="clock" className="text-blue-800 w-14 h-14" />
      <span className="font-bold text-gray-900 text-2xl">
        Track<span className="text-yellow-500">r</span>
      </span>
    </div>
  )
}
