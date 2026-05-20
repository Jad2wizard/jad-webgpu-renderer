<template>
  <div class="min-h-screen bg-gray-50 p-6">
    <div class="max-w-4xl mx-auto">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold">我的项目</h1>
        <div class="flex items-center gap-3">
          <el-button type="primary" @click="showCreate = true">新建项目</el-button>
          <el-dropdown>
            <el-button circle>
              <el-icon><UserFilled /></el-icon>
            </el-button>
            <template #dropdown>
              <el-dropdown-item @click="auth.logout(); router.push('/login')">
                退出登录
              </el-dropdown-item>
            </template>
          </el-dropdown>
        </div>
      </div>

      <div v-if="projects.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <el-card
          v-for="p in projects"
          :key="p.id"
          class="cursor-pointer hover:shadow-lg transition-shadow"
          @click="router.push(`/projects/${p.id}`)"
        >
          <h3 class="font-semibold text-lg">{{ p.name }}</h3>
          <p class="text-sm text-gray-400 mt-2">{{ p.description || '暂无描述' }}</p>
          <p class="text-xs text-gray-300 mt-3">
            创建于 {{ new Date(p.createdAt).toLocaleDateString() }}
          </p>
        </el-card>
      </div>

      <el-empty v-else description="还没有项目，点击上方按钮创建" />
    </div>

    <!-- 创建项目对话框 -->
    <el-dialog v-model="showCreate" title="新建项目" width="400px">
      <el-form @submit.prevent="handleCreate">
        <el-form-item label="名称">
          <el-input v-model="newName" placeholder="输入项目名称" />
        </el-form-item>
        <el-form-item label="描述">
          <el-input v-model="newDesc" type="textarea" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCreate = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="handleCreate">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue"
import { useRouter } from "vue-router"
import { ElMessage } from "element-plus"
import { UserFilled } from "@element-plus/icons-vue"
import { useAuthStore } from "@/stores/auth"
import { fetchProjects, createProject } from "@/utils/api"
import type { ProjectListItem } from "@shared/types"

const router = useRouter()
const auth = useAuthStore()

const projects = ref<ProjectListItem[]>([])
const showCreate = ref(false)
const newName = ref("")
const newDesc = ref("")
const creating = ref(false)

onMounted(async () => {
  try {
    const data = await fetchProjects()
    projects.value = data.projects
  } catch {
    ElMessage.error("加载项目列表失败")
  }
})

async function handleCreate() {
  if (!newName.value.trim()) {
    ElMessage.warning("请输入项目名称")
    return
  }
  creating.value = true
  try {
    const result = await createProject({ name: newName.value, description: newDesc.value })
    ElMessage.success("项目已创建")
    showCreate.value = false
    router.push(`/projects/${result.project.id}`)
  } catch (err: any) {
    ElMessage.error(err.data?.error || "创建失败")
  } finally {
    creating.value = false
  }
}
</script>
