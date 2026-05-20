<template>
	<div class="min-h-screen flex items-center justify-center bg-gray-50">
		<el-card class="w-full max-w-md">
			<template #header>
				<h2 class="text-xl font-bold text-center">登录</h2>
			</template>

			<el-form @submit.prevent="handleLogin" label-position="top">
				<el-form-item label="邮箱">
					<el-input v-model="email" type="email" placeholder="your@email.com" />
				</el-form-item>
				<el-form-item label="密码">
					<el-input
						v-model="password"
						type="password"
						placeholder="输入密码"
						show-password
					/>
				</el-form-item>
				<el-button type="primary" class="w-full" :loading="loading" @click="handleLogin">
					登录
				</el-button>
			</el-form>

			<p class="text-center mt-4 text-sm text-gray-500">
				还没有账号？<router-link to="/register" class="text-blue-600">注册</router-link>
			</p>
		</el-card>
	</div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
	if (!email.value || !password.value) {
		ElMessage.warning('请输入邮箱和密码')
		return
	}
	loading.value = true
	try {
		await auth.login({ email: email.value, password: password.value })
		ElMessage.success('登录成功')
		router.push('/projects')
	} catch (err: any) {
		ElMessage.error(err.data?.error || '登录失败')
	} finally {
		loading.value = false
	}
}
</script>
