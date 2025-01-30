export interface UtilityLink {
  text: string
  url: string
}

export interface Utility {
  id: keyof GinkoWebSettings['utilities']
  name: string
  description: string
  warning: string
  links: UtilityLink[]
}

export interface WebsiteTemplate {
  id: string
  name: string
  icon: string
  description: string
}

export interface GinkoWebSettings {
  utilities: {
    debug: boolean
    colocationFolder: boolean
    linter: boolean
    [key: string]: boolean
  }
  websitePath: {
    type: 'none' | 'standard' | 'custom'
    customPath?: string
    pathType?: 'relative' | 'absolute'
    template?: string
  }
  languages: {
    multipleLanguages: boolean
    mainLanguage: string
  }
  exclusions: {
    ignoredFolders: string
    ignoredFiles: string
  }
  pathConfiguration: {
    isConfigured: boolean
  }
}

export const DEFAULT_SETTINGS: GinkoWebSettings = {
  utilities: {
    debug: false,
    colocationFolder: false,
    linter: false,
  },
  websitePath: {
    type: 'none',
    template: '',
  },
  languages: {
    multipleLanguages: false,
    mainLanguage: 'en',
  },
  exclusions: {
    ignoredFolders: '',
    ignoredFiles: '',
  },
  pathConfiguration: {
    isConfigured: false,
  },
}
