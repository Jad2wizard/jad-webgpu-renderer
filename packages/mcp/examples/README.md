# Node.js WebGPU 渲染示例

本目录包含了在 Node.js 环境下使用 WebGPU 进行渲染的各种示例。

## 安装依赖

```bash
npm install
```

## 示例说明

### 1. 离线渲染示例 (`webgpu-offscreen-render.js`)

演示如何使用官方 `webgpu` 包进行离线渲染：
- 创建 WebGPU 设备和渲染管线
- 渲染简单的红色三角形到纹理
- 将渲染结果保存为 PPM 图像文件

```bash
npm run offscreen
```

**输出：** `output.ppm` 图像文件

### 2. 计算着色器示例 (`webgpu-compute-shader.js`)

演示如何使用 WebGPU 计算着色器进行并行计算：
- 实现大规模向量加法运算
- 对比 GPU 和 CPU 性能
- 展示 WebGPU 在科学计算中的应用

```bash
npm run compute
```

**特性：**
- 处理 100万个浮点数的向量加法
- 性能对比和验证
- 展示 GPU 并行计算优势

### 3. 窗口渲染示例 (`node-dawn-window.js`)

演示如何使用 `node-dawn` 创建窗口并进行实时渲染：
- 创建图形窗口
- 渲染旋转的彩色立方体
- 实时交互和事件处理

```bash
npm run window
```

**注意：** 需要额外安装 `node-dawn` 并且系统支持图形界面。

## 系统要求

### 基本要求
- Node.js 18.0.0 或更高版本
- 支持 WebGPU 的 GPU 驱动程序

### GPU 后端支持
- **Windows**: D3D12, Vulkan
- **macOS**: Metal, Vulkan (通过 MoltenVK)
- **Linux**: Vulkan, OpenGL

### 软件依赖
- 对于 Vulkan 后端：需要安装 Vulkan 驱动程序
- 对于窗口示例：需要图形界面环境

## 故障排除

### 常见问题

1. **"无法获取 WebGPU 适配器"**
   - 检查 GPU 驱动程序是否最新
   - 尝试不同的后端（vulkan, d3d12, metal, opengl）
   - 确认系统支持 WebGPU

2. **模块导入错误**
   - 确保使用 Node.js 18+ 版本
   - 检查 package.json 中的 `"type": "module"` 设置

3. **性能问题**
   - 尝试不同的 GPU 后端
   - 检查是否使用了集成显卡而非独立显卡
   - 确认 GPU 内存充足

### 调试选项

可以在创建 WebGPU 实例时添加调试选项：

```javascript
const navigator = { 
  gpu: create([
    'backend=vulkan',
    'enable-dawn-features=allow_unsafe_apis,dump_shaders',
    'disable-dawn-features=disallow_unsafe_apis'
  ]) 
};
```

### 可用的后端选项
- `backend=vulkan` - Vulkan API（推荐，跨平台）
- `backend=d3d12` - Direct3D 12（Windows）
- `backend=metal` - Metal（macOS）
- `backend=opengl` - OpenGL（兼容性后端）

## 进一步学习

- [WebGPU 规范](https://www.w3.org/TR/webgpu/)
- [Dawn 项目](https://dawn.googlesource.com/dawn)
- [WebGPU 示例](https://webgpu.github.io/webgpu-samples/)
- [计算着色器教程](https://web.dev/gpu-compute/)

## 许可证

MIT License