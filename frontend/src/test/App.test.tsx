import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from '../App'
import '../i18n/config'

describe('NxtPak AI Frontend Shell', () => {
  const queryClient = new QueryClient()

  it('renders application navigation and dashboard', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    )

    // Check brand title
    expect(screen.getByText(/NxtPak AI/i)).toBeInTheDocument()
    expect(screen.getByText(/Dashboard/i)).toBeInTheDocument()
    expect(screen.getAllByText(/New Project/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Standards/i).length).toBeGreaterThan(0)
  })
})
