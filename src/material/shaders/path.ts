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

    fn getAngle(v: vec2f) -> f32 {
        return (atan2(v.y, v.x) + 2 * PI) % (2 * PI);
    }

    @vertex fn vs(vert: Vertex) -> VSOutput {
        var vsOut: VSOutput;
        let posLen = arrayLength(&positions);
        let index = vert.vi % posLen;
        let p = positions[index % posLen];
        ${hasTime ? 'let time = startTimes[index % posLen];' : ''}
        let clipPos = projectionMatrix * viewMatrix * vec4f(p, 0, 1);
        let side = f32(vert.vi / posLen) * -2 + 1; //-1 or 1

        let pp = positions[(index - 1) % posLen];
        let np = positions[(index + 1) % posLen];
        let vnp = select(vec2f(np.x - p.x, np.y - p.y), vec2f(p.x - pp.x, p.y - pp.y), index == posLen - 1);
        let vpp = select(vec2f(pp.x - p.x, pp.y - p.y), vec2f(p.x - np.x, p.y - np.y), index == 0);
        let anp = getAngle(vnp);
        let app = getAngle(vpp);
        let angle = (app - anp + 2 * PI) % (2 * PI);//连线 pp -> p -> np 的左侧夹角
        let lineWidth =  style.lineWidth / abs(sin(angle / 2));
        let s = sin(angle / 2 + anp);
        let c = cos(angle / 2 + anp);
        let v = side * vec2f(c, s) * lineWidth / resolution * clipPos.w;

        vsOut.position = vec4f(clipPos.xy + v, clipPos.z, clipPos.w);
        ${hasTime ? 'vsOut.startTime = time;' : ''}
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
            if(time - vsOut.startTime > tailDuration){
                discard;
            }
            let tailOpacity = clamp((vsOut.startTime - time + tailDuration) / tailDuration, 0, 1);
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
    @group(1) @binding(1) var<storage, read> positions: array<vec2f>;
    @group(1) @binding(3) var<storage, read> startTimes: array<f32>;
    @group(1) @binding(2) var<uniform> time: f32;
    @group(1) @binding(5) var<uniform> size: f32;
    @group(1) @binding(6) var<uniform> pointIndex: u32;
	@group(1) @binding(7) var<uniform> headPointColor: vec4f;

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
