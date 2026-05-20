import { createRouter, createWebHistory } from "vue-router"

const routes = [
  {
    path: "/login",
    name: "login",
    component: () => import("@/views/LoginPage.vue"),
    meta: { guest: true },
  },
  {
    path: "/register",
    name: "register",
    component: () => import("@/views/RegisterPage.vue"),
    meta: { guest: true },
  },
  {
    path: "/projects",
    name: "projects",
    component: () => import("@/views/ProjectsPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/projects/:id",
    name: "project-editor",
    component: () => import("@/views/ProjectEditorPage.vue"),
    meta: { requiresAuth: true },
  },
  {
    path: "/:pathMatch(.*)*",
    redirect: "/projects",
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

// 路由守卫
router.beforeEach((to) => {
  const token = localStorage.getItem("token")
  if (to.meta.requiresAuth && !token) return "/login"
  if (to.meta.guest && token) return "/projects"
})

export default router
