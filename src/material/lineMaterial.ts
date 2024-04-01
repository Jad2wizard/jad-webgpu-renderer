import Material from './material'
import { Blending } from 'localType'

type IProps = {
	color?: [number, number, number, number]
	lineWidth?: number
	blending?: Blending
}

const code = `
    struct Vertex {
        @location(0) side: f32,
        @builtin(vertex_index) vi: u32,
    };

    @group(0) @binding(0) var<uniform> projectionMatrix: mat4x4f;
    @group(0) @binding(1) var<uniform> viewMatrix: mat4x4f;
    @group(0) @binding(2) var<uniform> resolution: vec2f;
    @group(1) @binding(0) var<uniform> color: vec4f;
    @group(1) @binding(1) var<storage, read> positions: array<vec2f>;
    @group(1) @binding(2) var<storage, read> angles: array<f32>;

    struct VSOutput {
        @builtin(position) position: vec4f
    };

    @vertex fn vs(vert: Vertex) -> VSOutput {
        let w = 5f;
        var vsOut: VSOutput;
        let pos = positions[vert.vi % arrayLength(&positions)];
        let angle = angles[vert.vi % arrayLength(&angles)];
        let clipPos = projectionMatrix * viewMatrix * vec4f(pos, 0, 1);
        let s = sin(angle);
        let c = cos(angle);
        let v = vert.side * vec2f(c, s) * w / resolution * clipPos.w;
        vsOut.position = vec4f(clipPos.xy + v, clipPos.z, clipPos.w);
        return vsOut;
    }

    @fragment fn fs(vsOut: VSOutput) -> @location(0) vec4f {
        return vec4f(color.rgb * color.a, color.a);
    }
`

class LineMaterial extends Material {
	constructor(props: IProps) {
		const color = props.color || [1, 0, 0, 1]
		super({ shaderCode: code, blending: props.blending, uniforms: { color } })
	}
}

export default LineMaterial