import { defineStore } from "pinia"
import { ref, computed } from "vue"
import { ofetch } from "ofetch"
import type { AuthResponse, LoginRequest, RegisterRequest } from "@shared/types"

export const useAuthStore = defineStore("auth", () => {
  const user = ref<AuthResponse["user"] | null>(null)
  const token = ref<string | null>(localStorage.getItem("token"))

  const isLoggedIn = computed(() => !!token.value)

  function setAuth(data: AuthResponse) {
    user.value = data.user
    token.value = data.token
    localStorage.setItem("token", data.token)
  }

  async function login(input: LoginRequest) {
    const data = await ofetch<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: input,
    })
    setAuth(data)
    return data
  }

  async function register(input: RegisterRequest) {
    const data = await ofetch<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: input,
    })
    setAuth(data)
    return data
  }

  function logout() {
    user.value = null
    token.value = null
    localStorage.removeItem("token")
  }

  return { user, token, isLoggedIn, login, register, logout, setAuth }
})
