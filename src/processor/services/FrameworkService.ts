import { Framework, FrameworkConfig } from '../types/framework'
import { nuxtFileTypes } from '../configs/nuxt/fileTypes'
import { astroFileTypes } from '../configs/astro/fileTypes'
import { NuxtTaskProcessor } from '../configs/nuxt/NuxtTaskProcessor'
import { AstroTaskProcessor } from '../configs/astro/AstroTaskProcessor'
import { nuxtPaths } from '../configs/nuxt/paths'
import { astroPaths } from '../configs/astro/paths'

export class FrameworkService {
  private static configs: Record<Framework, FrameworkConfig> = {
    nuxt: {
      fileTypes: nuxtFileTypes,
      taskProcessor: new NuxtTaskProcessor(),
      paths: nuxtPaths
    },
    astro: {
      fileTypes: astroFileTypes,
      taskProcessor: new AstroTaskProcessor(),
      paths: astroPaths
    }
  }

  public static getConfig(framework: Framework): FrameworkConfig {
    return this.configs[framework]
  } 
} 