import Image from 'next/image'

type LogoSize = 'sm' | 'header' | 'md' | 'xl'

// El logo original es 1080×612 → ratio ~1.765:1
const ASPECT = 1.765

const SIZES: Record<LogoSize, { height: number; className: string }> = {
  // Footer / admin — mini marca
  sm: {
    height: 24,
    className: '',
  },
  // Header — compacto horizontal
  header: {
    height: 28,
    className: 'transition-transform group-hover:scale-105',
  },
  // Login — mediano centrado
  md: {
    height: 48,
    className: '',
  },
  // Hero lobby — grande
  xl: {
    height: 96,
    className: 'drop-shadow-[0_0_30px_rgba(255,0,200,0.25)]',
  },
}

interface LogoProps {
  size?: LogoSize
  className?: string
  priority?: boolean
}

/**
 * Logo oficial de Juega Hip Hop (pixel art morado→magenta).
 * Variante horizontal: "JUEGA" arriba, "HIP ★ HOP" abajo.
 */
export default function Logo({ size = 'md', className = '', priority = false }: LogoProps) {
  const { height, className: sizeClassName } = SIZES[size]
  const width = Math.round(height * ASPECT)

  return (
    <Image
      src="/icons/logojuegahiphop.png"
      alt="Juega Hip Hop"
      width={width}
      height={height}
      priority={priority}
      className={`${sizeClassName} ${className}`.trim()}
    />
  )
}
