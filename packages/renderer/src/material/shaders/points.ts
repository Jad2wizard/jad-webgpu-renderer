//wgsl 代码编译时会将未使用的 uniform 变量定义代码删掉，导致 pipeline.layout 为auto 时，不会创建这些 uniform 的 bindGroupLayout
//而我们使用的 webgpu-utils 库会将这些 uniforms 变量解析出来，导致我们在依靠 webgpu-utils 解析出来的 uniform 定义创建 bindGroup时，
//上述 uniform 的 bindGroup 会找不到 bindGroupLayout，从而报错
//所以我们需要人为地将 wgsl 代码中未使用的 uniform 定义删除
export const getShaderCode = (hasColor: boolean, hasRadius: boolean, hasTime: boolean) => `
    struct Vertex {
        @builtin(vertex_index) vi: u32,
        @builtin(instance_index) ii: u32,
        @location(0) position: vec2f,
        ${hasColor ? '@location(1) color: vec4u,' : ''}
        ${hasTime ? '@location(2) startTime: f32,' : ''}
    };

    struct Style {
        color: vec4f,
        radius: f32,
        currentTime: f32,
    };

    @group(0) @binding(0) var<uniform> projectionMatrix: mat4x4f;
    @group(0) @binding(1) var<uniform> viewMatrix: mat4x4f;
    @group(0) @binding(2) var<uniform> resolution: vec2f;
    @group(1) @binding(0) var<uniform> style: Style;
    @group(1) @binding(1) var<storage, read> radius: array<u32>;
    

    struct VSOutput {
        @builtin(position) position: vec4f,
        ${hasTime ? '@location(0) time: f32,' : ''}
        @location(1) color: vec4f,
        @location(2) pointCoord: vec2f,
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

        let pos = points[vert.vi];
        ${
			hasRadius
				? `
                    let si = vert.ii / 4u;
                    let sj = vert.ii % 4u;
                    let size = f32((radius[si] >> (sj * 8u)) & 255u) * 2;
                    // let size = f32(radius[si]) / 20000000f;
                    // let size = f32(radius[0]) * 5;
                    let a = radius[0];
                    _ = style;
                `
				: `
                    let size = style.radius * 2;
                    if(false){
                        let a = radius[0];
                    }
                `
		}

        let clipPos = projectionMatrix * viewMatrix * vec4f(vert.position, 0, 1);
        let pointPos = vec4f(pos * size / resolution * clipPos.w, 0, 0);

        vsOut.position = clipPos + pointPos;

        vsOut.pointCoord = pos;

        ${
			hasColor
				? `
                let x = f32(vert.color.x) / 255f;
                let y = f32(vert.color.y) / 255f;
                let z = f32(vert.color.z) / 255f;
                let w = f32(vert.color.w) / 255f;
                let color: vec4f = vec4f(x, y, z, w);
            `
				: 'let color = style.color;'
		}
        vsOut.color = color;

        ${hasTime ? 'vsOut.time = vert.startTime;' : ''}

        return vsOut;
    }

    @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
        let coord = vsOut.pointCoord;
        let dis = length(coord);
        if(dis >= 1) {
            discard;
        }
        
        ${
			hasTime
				? `
            if(vsOut.time > style.currentTime){
                discard;
            }
            `
				: ''
		}

        let edgeAlpha = smoothstep(0, 0.1, 1 - dis);

        let c = vsOut.color;
        let alpha = c.a * edgeAlpha;
        return vec4f(c.rgb * alpha, alpha);
    }
`
