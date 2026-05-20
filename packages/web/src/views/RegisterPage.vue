<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50">
    <el-card class="w-full max-w-md">
      <template #header>
        <h2 class="text-xl font-bold text-center">注册</h2>
      </template>

      <el-form @submit.prevent="handleRegister" label-position="top">
        <el-form-item label="用户名">
          <el-input v-model="name" placeholder="你的名字" />
        </el-form-item>
        <el-form-item label="邮箱">
          <el-input v-model="email" type="email" placeholder="your@email.com" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="password" type="password" placeholder="至少6位" show-password />
        </el-form-item>
        <el-button type="primary" class="w-full" :loading="loading" @click="handleRegister">
          注册
        </el-button>
      </el-form>

      <p class="text-center mt-4 text-sm text-gray-500">
        已有账号？<router-link to="/login" class="text-blue-600">登录</router-link>
      </p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"
import { useRouter } from "vue-router"
import { ElMessage } from "element-plus"
import { useAuthStore } from "@/stores/auth"

const router = useRouter()
const auth = useAuthStore()

const name = ref("")
const email = ref("")
const password = ref("")
const loading = ref(false)

async function handleRegister() {
  if (!email.value || !password.value) {
    ElMessage.warning("请输入邮箱和密码")
    return
  }
  if (password.value.length < 6) {
    ElMessage.warning("密码至少需要6个字符")
    return
  }
  loading.value = true
  try {
    await auth.register({
      email: email.value,
      password: password.value,
      name: name.value,
    })
    ElMessage.success("注册成功")
    router.push("/projects")
  } catch (err: any) {
    ElMessage.error(err.data?.error || "注册失败")
  } finally {
    loading.value = false
  }
}
</script>
