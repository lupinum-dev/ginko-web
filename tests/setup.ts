import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/vue'

// Automatically clean up after each test
afterEach(() => {
  cleanup()
})

// Global mocks or setup can be added here 