const variants = {
  primary: 'bg-blue-800 hover:bg-blue-900 text-white',
  secondary: 'bg-gray-100 hover:bg-gray-200 text-gray-800 border border-gray-300',
  success: 'bg-green-600 hover:bg-green-700 text-white',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'bg-transparent hover:bg-gray-100 text-gray-700',
  'text-danger': 'bg-transparent hover:bg-red-50 text-red-600',
}

export default function Button({
  type = 'button',
  variant = 'primary',
  icon = null,
  children,
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant] || variants.primary} ${className}`.trim()}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
