import { Router, Request, Response } from "express"
import { eq, and } from "drizzle-orm"
import { auth } from "../middleware/auth"
import { db } from "../db"
import { projects, layers } from "../db/schema"
import type { ProjectListItem, ProjectDetail, LayerConfig } from "../../shared/types"

const router = Router()

/**
 * GET /api/projects
 * 获取当前用户的所有项目列表
 */
router.get("/projects", auth, async (req: Request, res: Response) => {
  const list = await db()
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .where(eq(projects.ownerId, req.userId!))
    .all()

  const result: ProjectListItem[] = list.map((p) => ({
    ...p,
    description: p.description ?? null,
  }))

  res.json({ projects: result })
})

/**
 * POST /api/projects
 * 创建新项目
 */
router.post("/projects", auth, async (req: Request, res: Response) => {
  const { name, description } = req.body
  const id = crypto.randomUUID()

  await db().insert(projects).values({
    id,
    name: name || "未命名项目",
    description: description || "",
    ownerId: req.userId!,
  })

  res.status(201).json({
    project: { id, name: name || "未命名项目", description: description || null },
  })
})

/**
 * GET /api/projects/:id
 * 获取项目详情（含完整配置和图层列表）
 */
router.get("/projects/:id", auth, async (req: Request, res: Response) => {
  const proj = await db()
    .select()
    .from(projects)
    .where(and(eq(projects.id, req.params.id), eq(projects.ownerId, req.userId!)))
    .get()

  if (!proj) {
    return res.status(404).json({ error: "项目不存在" })
  }

  // 获取所有图层
  const layerList = await db()
    .select()
    .from(layers)
    .where(eq(layers.projectId, req.params.id))
    .all()

  const detail: ProjectDetail = {
    id: proj.id,
    ownerId: proj.ownerId,
    name: proj.name,
    description: proj.description ?? null,
    viewport: JSON.parse(proj.viewport),
    tileConfig: JSON.parse(proj.tileConfig),
    layers: layerList.map((l) => ({
      ...JSON.parse(l.config),
      id: l.id,
      name: l.name,
      type: l.type,
      visible: !!l.visible,
      level: l.level,
      datasetId: l.datasetId,
    })) as LayerConfig[],
    createdAt: proj.createdAt,
    updatedAt: proj.updatedAt,
  }

  res.json({ project: detail })
})

/**
 * PUT /api/projects/:id
 * 更新项目基本信息（名称、描述、视口、瓦片）
 */
router.put("/projects/:id", auth, async (req: Request, res: Response) => {
  const proj = await db()
    .select()
    .from(projects)
    .where(and(eq(projects.id, req.params.id), eq(projects.ownerId, req.userId!)))
    .get()

  if (!proj) {
    return res.status(404).json({ error: "项目不存在" })
  }

  const updates: Record<string, unknown> = {}
  if (req.body.name !== undefined) updates.name = req.body.name
  if (req.body.description !== undefined) updates.description = req.body.description
  if (req.body.viewport !== undefined) updates.viewport = JSON.stringify(req.body.viewport)
  if (req.body.tileConfig !== undefined) updates.tileConfig = JSON.stringify(req.body.tileConfig)

  if (Object.keys(updates).length > 0) {
    await db()
      .update(projects)
      .set(updates)
      .where(eq(projects.id, req.params.id))
  }

  res.json({ success: true })
})

/**
 * DELETE /api/projects/:id
 * 删除项目（级联删除图层和数据集）
 */
router.delete("/projects/:id", auth, async (req: Request, res: Response) => {
  const proj = await db()
    .select()
    .from(projects)
    .where(and(eq(projects.id, req.params.id), eq(projects.ownerId, req.userId!)))
    .get()

  if (!proj) {
    return res.status(404).json({ error: "项目不存在" })
  }

  await db().delete(projects).where(eq(projects.id, req.params.id))

  res.json({ success: true })
})

export default router
