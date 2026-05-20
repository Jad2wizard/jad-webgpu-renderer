import { Router, Request, Response } from "express"
import bcrypt from "bcryptjs"
import { eq } from "drizzle-orm"
import { db } from "../db"
import { users } from "../db/schema"
import { signToken } from "../middleware/auth"
import type { RegisterRequest, LoginRequest, AuthResponse } from "../../shared/types"

const router = Router()

/**
 * POST /api/auth/register
 * 用户注册
 */
router.post("/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body as RegisterRequest

    if (!email || !password) {
      return res.status(400).json({ error: "邮箱和密码为必填项" })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "密码至少需要 6 个字符" })
    }

    // 检查邮箱是否已注册
    const existing = await db()
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get()

    if (existing) {
      return res.status(409).json({ error: "该邮箱已注册" })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const id = crypto.randomUUID()

    await db().insert(users).values({
      id,
      email,
      passwordHash,
      name: name || "",
    })

    const token = signToken(id)
    const response: AuthResponse = {
      user: { id, email, name: name || "" },
      token,
    }

    res.status(201).json(response)
  } catch (err) {
    console.error("Register error:", err)
    res.status(500).json({ error: "注册失败，请稍后再试" })
  }
})

/**
 * POST /api/auth/login
 * 用户登录
 */
router.post("/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as LoginRequest

    if (!email || !password) {
      return res.status(400).json({ error: "邮箱和密码为必填项" })
    }

    const user = await db()
      .select()
      .from(users)
      .where(eq(users.email, email))
      .get()

    if (!user) {
      return res.status(401).json({ error: "邮箱或密码错误" })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return res.status(401).json({ error: "邮箱或密码错误" })
    }

    const token = signToken(user.id)
    const response: AuthResponse = {
      user: { id: user.id, email: user.email, name: user.name },
      token,
    }

    res.json(response)
  } catch (err) {
    console.error("Login error:", err)
    res.status(500).json({ error: "登录失败，请稍后再试" })
  }
})

export default router
