# 性能优化记录 / Performance Optimization Record

## 1. 坐标转换 / Coordinate Transformation

针对 `lonlat2World` 函数的性能优化记录。测试场景为 100 万个散点（ScatterLayer）的位置转换。

| 优化目标 (Target)          | 原始方案 (Baseline) | JS 数学优化 (JS Math Opt) | WASM 优化 (WASM Opt) |
| :------------------------- | :------------------ | :------------------------ | :------------------- |
| lonlat2World (100w points) | 250ms               | 35ms                      | (待记录)             |

### 详细说明

1. **原始方案 (Baseline)**:
    - 使用 `proj4` 库进行坐标投影。
    - 每次转换创建新的 `Vector2` 对象。
    - 耗时: ~250ms

2. **JS 数学优化 (JS Math Opt)**:
    - 移除 `proj4` 依赖，使用 Web Mercator 数学公式直接计算。
    - 移除 `Vector2` 对象创建，返回原生对象 `{x, y}` 以减少 GC 压力。
    - 耗时: ~35ms (提升约 7 倍)

3. **WASM 优化**:
    - 预留用于记录使用 WebAssembly 实现后的性能数据。
