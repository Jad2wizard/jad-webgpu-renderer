//wgsl 代码编译时会将未使用的 uniform 变量定义代码删掉，导致 pipeline.layout 为auto 时，不会创建这些 uniform 的 bindGroupLayout
//而我们使用的 webgpu-utils 库会将这些 uniforms 变量解析出来，导致我们在依靠 webgpu-utils 解析出来的 uniform 定义创建 bindGroup时，
//上述 uniform 的 bindGroup 会找不到 bindGroupLayout，从而报错
//所以我们需要人为地将 wgsl 代码中未使用的 uniform 定义删除
export const getShaderCode = (hasColor: boolean, hasSize: boolean) => `
    struct Vertex {
        @builtin(vertex_index) vi: u32,
        @builtin(instance_index) ii: u32,
        @location(0) position: vec2f,
        ${hasColor ? '@location(1) color: vec4u,' : ''}
    };

    struct Style {
        color: vec4f,
        size: f32,
        highlightColor: vec4f,
        highlightSize: f32,
    };

    @group(0) @binding(0) var<uniform> projectionMatrix: mat4x4f;
    @group(0) @binding(1) var<uniform> viewMatrix: mat4x4f;
    @group(0) @binding(2) var<uniform> resolution: vec2f;
    @group(1) @binding(0) var<storage, read> highlightFlags: array<u32>;
    @group(1) @binding(1) var<uniform> style: Style;
    ${hasSize ? '@group(1) @binding(2) var<storage, read> sizes: array<u32>;' : ''}
    

    struct VSOutput {
        @builtin(position) position: vec4f,
        ${hasColor ? '@location(0) color: vec4f,' : ''}
        @location(1) pointCoord: vec2f,
        @location(2) highlight: f32,
    };

    @vertex fn vs(vert: Vertex) -> VSOutput {
        var vsOut: VSOutput;
        let points = array(
            vec2f(-1, -1),
            vec2f( 1, -1),
            vec2f(-1,  1),
            vec2f(-1,  1),
            vec2f( 1, -1),
            vec2f( 1,  1),
        );

        let hi = vert.ii / 32u;
        let hj = vert.ii % 32u;
        var highlight = f32((highlightFlags[hi] >> hj) & 1u);
        vsOut.highlight = highlight;

        let pos = points[vert.vi];
        ${
			hasSize
				? `
            let si = vert.ii / 4u;
            let sj = vert.ii % 4u;
            let size = f32((sizes[si] >> (sj * 8)) & 255u);
        `
				: 'let size = style.size;'
		}

        let s = mix(size, style.highlightSize, highlight);
        let clipPos = projectionMatrix * viewMatrix * vec4f(vert.position, 0, 1);
        let pointPos = vec4f(pos * s / resolution * clipPos.w, 0, 0);

        vsOut.position = clipPos + pointPos;

        vsOut.pointCoord = pos;

        ${hasColor ? 'vsOut.color = vec4f(vert.color) / 255f;' : ''}

        return vsOut;
    }

    @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
        let coord = vsOut.pointCoord;
        let dis = length(coord);
        if(dis >= 1) {
            discard;
        }
        let edgeAlpha = smoothstep(0, 0.1, 1 - dis);

        let color = ${hasColor ? 'vsOut.color' : 'style.color'};
        let c = mix(color, style.highlightColor, vsOut.highlight);
        let alpha = c.a * edgeAlpha;
        return vec4f(c.rgb * alpha, alpha);
        // return vec4f(1, 0, 0, 1);
    }
`
