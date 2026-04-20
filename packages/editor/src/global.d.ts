import type { ThreeElements } from '@react-three/fiber'

declare module 'react' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  namespace JSX {
    interface IntrinsicElements extends ThreeElements {}
  }
}