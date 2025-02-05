export interface ComponentChild {
  type: string
  position: number
  main?: string
  content?: string
  props: Record<string, string>
  children?: ComponentChild[]
}

export interface ComponentInfo {
  component: string
  main?: string
  content?: string
  props: Record<string, string>
  children?: ComponentChild[]
}
