export const computeShader = `
struct Uniforms {
    targetPos: vec2<f32>,
    radiusSq: f32,
    total: u32,
}

struct Result {
    count: atomic<u32>,
    indices: array<u32, 1024>,
}

@group(0) @binding(0) var<storage, read> positions: array<f32>;
@group(0) @binding(1) var<uniform> params: Uniforms;
@group(0) @binding(2) var<storage, read_write> result: Result;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (index >= params.total) {
        return;
    }

    let px = positions[index * 2];
    let py = positions[index * 2 + 1];
    let dx = px - params.targetPos.x;
    let dy = py - params.targetPos.y;
    let distSq = dx * dx + dy * dy;

    if (distSq <= params.radiusSq) {
        let idx = atomicAdd(&result.count, 1u);
        if (idx < 1024u) {
            result.indices[idx] = index;
        }
    }
}
`
