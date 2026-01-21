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

## 2. 拾取性能对比 (Compute Shader vs Static KDTree)

对比两种拾取方案在不同数据量下的性能表现：
1. **Compute Shader**: 基于 GPU 并行计算的拾取方案。
2. **Static KDTree**: 基于 CPU 构建静态 KDTree 的拾取方案（利用 `typedarray-pool` 复用内存）。

### 10万散点 (100k points)

| 指标 (Metric)    | Compute Shader | Static KDTree | 备注 (Note)                                |
| :--------------- | :------------- | :------------ | :----------------------------------------- |
| 拾取耗时(ms)     | 319.28         | 2.68          |                                            |
| JS Heap Size(MB) | 93.87          | 92.89         | kdtree和positions 共享 buffer 后变为78.6MB |

### 100万散点 (1m points)

| 指标 (Metric)    | Compute Shader | Static KDTree | 备注 (Note) |
| :--------------- | :------------- | :------------ | :---------- |
| 拾取耗时(ms)     | 3260.12        | 9.34          |             |
| JS Heap Size(MB) | 234.65         | 414.08        |             |

### 总结 / Summary

1. kdtree 的检索速度远优于受 CPU-GPU 通信延迟影响的 Compute Shader 方案。
2. 因为构建空间索引树需要所有点的坐标数据，所以 kdtree 所占用的内存空间更多
