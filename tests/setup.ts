import { cleanup } from '@testing-library/vue'
import { afterEach } from 'vitest'

// Automatically clean up after each test
afterEach(() => {
  cleanup()
})

// Global mocks or setup can be added here
