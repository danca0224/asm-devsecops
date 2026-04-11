import { render, screen } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from '../api/auth'
import Login from './Login'

const Wrapper = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>{children}</AuthProvider>
  </BrowserRouter>
)

describe('Login page', () => {
  it('renders login form', () => {
    render(<Login />, { wrapper: Wrapper })
    expect(screen.getByPlaceholderText('admin')).toBeInTheDocument()
    expect(screen.getByText('Iniciar sesión')).toBeInTheDocument()
  })

  it('shows ASM title', () => {
    render(<Login />, { wrapper: Wrapper })
    expect(screen.getByText('ASM')).toBeInTheDocument()
  })
})
