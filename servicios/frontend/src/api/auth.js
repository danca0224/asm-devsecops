import { useState, useEffect, useContext, createContext } from 'react'
import axios from 'axios'

const API = axios.create({ baseURL: '/api' })

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('asm_token'))
  const [user, setUser]   = useState(() => {
    try { return JSON.parse(localStorage.getItem('asm_user')) } catch { return null }
  })

  useEffect(() => {
    if (token) {
      API.defaults.headers.common['Authorization'] = `Bearer ${token}`
    } else {
      delete API.defaults.headers.common['Authorization']
    }
  }, [token])

  const login = async (username, password) => {
    const form = new URLSearchParams()
    form.append('username', username)
    form.append('password', password)
    const res = await API.post('/auth/token', form)
    const { access_token, username: uname, role } = res.data
    setToken(access_token)
    const userObj = { username: uname, role }
    setUser(userObj)
    localStorage.setItem('asm_token', access_token)
    localStorage.setItem('asm_user', JSON.stringify(userObj))
    API.defaults.headers.common['Authorization'] = `Bearer ${access_token}`
  }

  const logout = () => {
    setToken(null)
    setUser(null)
    localStorage.removeItem('asm_token')
    localStorage.removeItem('asm_user')
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
export { API }
