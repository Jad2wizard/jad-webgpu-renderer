export const genShaderCode = (hasTime: boolean, hasTail: boolean) => `
    const PI = radians(180.0);
    struct Vertex {
        @builtin(vertex_index) vi: u32,
    };

    struct Style {
        color:  vec4f,
        lineWidth: f32,
        ${hasTime ? 'unplayedColor: vec4f,' : ''}
    };

    @group(0) @binding(0) var<uniform> projectionMatrix: mat4x4f;
    @group(0) @binding(1) var<uniform> viewMatrix: mat4x4f;
    @group(0) @binding(2) var<uniform> resolution: vec2f;
    @group(1) @binding(0) var<uniform> style: Style;
    @group(1) @binding(1) var<storage, read> positions: array<vec2f>;
    ${hasTime ? '@group(1) @binding(2) var<uniform> time: f32;' : ''} 
    ${hasTime ? '@group(1) @binding(3) var<storage, read> startTimes: array<f32>;' : ''}
    ${hasTime && hasTail ? '@group(1) @binding(4) var<uniform> tailDuration: f32;' : ''} 

    struct VSOutput {
        @builtin(position) position: vec4f,
        ${hasTime ? '@location(0) startTime: f32' : ''}
    };

    fn toClip(pos: vec2f) -> vec4f {
        //将模型空间坐标转换为裁剪空间坐标，即 vs 的输出坐标
        return projectionMatrix * viewMatrix * vec4f(pos, 0.0, 1.0);
    }

    @vertex fn vs(vert: Vertex) -> VSOutput {
        var vsOut: VSOutput;
        let posLen = arrayLength(&positions);
        
        let index = vert.vi % posLen;
        let p_Model = positions[index];
        let side = f32(vert.vi / posLen) * -2.0 + 1.0;
        
        // 将当前点和相邻点投影到 Clip Space
        let p_Clip = toClip(p_Model);
        
        // 获取前一个和后一个点的索引，避免下溢和上溢
        let prevIndex = max(index, 1u) - 1u;
        let nextIndex = min(index + 1u, posLen - 1u);

        let pPrev_Model = positions[prevIndex];
        let pNext_Model = positions[nextIndex];
        
        //  将点坐标转换到屏幕空间，计算线宽以及方向，避免透视导致的线段宽度失真
        let pPrev_Clip = toClip(pPrev_Model);
        let pNext_Clip = toClip(pNext_Model);

        let p_Screen = (p_Clip.xy / p_Clip.w) * resolution;
        let pPrev_Screen = (pPrev_Clip.xy / pPrev_Clip.w) * resolution;
        let pNext_Screen = (pNext_Clip.xy / pNext_Clip.w) * resolution;

        // 计算屏幕空间的切线向量
        var dirPrev_Screen = vec2f(0.0);
        var dirNext_Screen = vec2f(0.0);

        let dPrev = p_Screen - pPrev_Screen;
        if (length(dPrev) > 0.001) {
            dirPrev_Screen = normalize(dPrev);
        }

        let dNext = pNext_Screen - p_Screen;
        if (length(dNext) > 0.001) {
            dirNext_Screen = normalize(dNext);
        }
        
        //  拐角 斜接线长度
        var miterLen = 1.0;
        
        // 计算切线方向，等于相连的两个 线段的向量和
        let tangent_Screen = normalize(dirPrev_Screen + dirNext_Screen);
        // 计算斜接线方向，等于切线的垂线
        var miter_Screen = vec2f(-tangent_Screen.y, tangent_Screen.x);
        
        // 拐角处前面的线段的法线方向
        let n_Screen = vec2f(-dirPrev_Screen.y, dirPrev_Screen.x);
        // 通过向量点乘得到拐角平分线与法线的夹角的余弦值，用于计算斜接线长度
        let dotVal = dot(miter_Screen, n_Screen);
        
        let isStart = step(f32(index), 0.5); // 1.0 if index <= 0.5 (i.e. 0)
        let isEnd = step(f32(posLen) - 1.5, f32(index)); // 1.0 if index >= len - 1
        let isEndpoint = max(isStart, isEnd);
        
        // 处理极小角度保护 (abs(dotVal) > 0.1)
        let miterMiddle = select(1.0, 1.0 / dotVal, abs(dotVal) > 0.1);
        
        // 限制最大斜接长度
        let miterClamped = min(miterMiddle, 5.0);

        // 如果 isEndpoint > 0.5 (是端点)，取 1.0；否则取 miterClamped
        miterLen = select(miterClamped, 1.0, isEndpoint > 0.5);

        //  计算线段两端端点的屏幕坐标和裁剪空间坐标
        let offset_Screen = miter_Screen * side * style.lineWidth * 0.5 * miterLen;
        let offset_Clip = (offset_Screen / resolution) * 2.0 * p_Clip.w;

        vsOut.position = vec4f(p_Clip.xy + offset_Clip, p_Clip.z, p_Clip.w);

        ${hasTime ? 'vsOut.startTime = startTimes[index];' : ''}
        return vsOut;
    }

    @vertex fn lineVs(vert: Vertex) -> VSOutput {
        _ = resolution;
        var vsOut: VSOutput;
        let posLen = arrayLength(&positions);
        let index = vert.vi % posLen;
        let p = positions[index % posLen];
        ${hasTime ? 'let time = startTimes[index % posLen];' : ''}

        vsOut.position = vec4f(projectionMatrix * viewMatrix * vec4f(p, 0, 1));
        ${hasTime ? 'vsOut.startTime = time;' : ''}
        return vsOut;
    }

    @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
        ${
			hasTail && hasTime
				? `
            let age = time - vsOut.startTime;
            if(age > tailDuration){
                discard;
            }
            let life = clamp(1.0 - age / tailDuration, 0.0, 1.0);
            
            // 使用 smoothstep 让衰减更自然：头部更实，尾部更虚
            let tailOpacity = smoothstep(0.0, 1.0, life);
        `
				: ''
		}
        ${
			hasTime
				? 'let color = mix(style.color, style.unplayedColor, step(0f, vsOut.startTime - time));'
				: 'let color = style.color;'
		}
        ${
			hasTail && hasTime
				? 'return vec4f(color.rgb * color.a * tailOpacity, color.a * tailOpacity);'
				: 'return vec4f(color.rgb * color.a, color.a);'
		}
        
    }
`

export const genHeadPointShaderCode = () => `
    @group(0) @binding(0) var<uniform> projectionMatrix: mat4x4f;
    @group(0) @binding(1) var<uniform> viewMatrix: mat4x4f;
    @group(0) @binding(2) var<uniform> resolution: vec2f;
    @group(1) @binding(0) var<storage, read> positions: array<vec2f>;
    @group(1) @binding(1) var<storage, read> startTimes: array<f32>;
    @group(1) @binding(2) var<uniform> time: f32;
    @group(1) @binding(3) var<uniform> size: f32;
    @group(1) @binding(4) var<uniform> pointIndex: u32;
	@group(1) @binding(5) var<uniform> headPointColor: vec4f;

    struct VSOut {
        @builtin(position) position: vec4f,
        @location(0) pointCoord: vec2f,
    }

    @vertex fn vs(@builtin(vertex_index) vi: u32) -> VSOut{
        let points = array(
            vec2f(-1, -1),
            vec2f( 1, -1),
            vec2f(-1,  1),
            vec2f(-1,  1),
            vec2f( 1, -1),
            vec2f( 1,  1),
        );
        let posLen = arrayLength(&positions);
        let pos = points[vi];
        var vsOut: VSOut;
        var clipPos: vec4f;

        if(time >= startTimes[posLen - 1]){
            clipPos = projectionMatrix * viewMatrix * vec4f(positions[posLen - 1], 0, 1);
        } else {
            let prevPoint = positions[pointIndex];
            let prevTime = startTimes[pointIndex];
            let nextTime = startTimes[pointIndex + 1];
            let nextPoint = positions[pointIndex + 1];
            let dir = normalize(nextPoint - prevPoint);
            let dis = length(nextPoint - prevPoint);
            let currPos = dis * (time  - prevTime) / (nextTime - prevTime) * dir + prevPoint;
            clipPos = projectionMatrix * viewMatrix * vec4f(currPos, 0, 1);
        }

        let pointPos = vec4f(pos * size / resolution * clipPos.w, 0, 0);
        vsOut.position = clipPos + pointPos;
        vsOut.pointCoord = pos;

        return vsOut;
    }

    @fragment fn fs(vsOut: VSOut) -> @location(0) vec4f{
        let coord = vsOut.pointCoord;
        let dis = length(coord);
        if(dis >= 1) {
            discard;
        }
        let edgeAlpha = smoothstep(0, 0.1, 1 - dis);

        return headPointColor * edgeAlpha;
        
    }
`
